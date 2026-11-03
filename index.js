/**
 * Host half of the Usage Insights bundle.
 *
 * Folds the real, durable session corpus (`ctx.sessionQuery`) into token,
 * cost, budget, timeline, and per-session aggregates, samples CPU/memory, and
 * serves the resulting JSON snapshot to the Client half over one read-only
 * loopback route registered on `ctx.webServer`.
 *
 * The session log is the only source of truth: nothing is persisted here and
 * every value is recomputed from committed `assistant/message` usage records.
 */
import os from 'node:os'

const ROUTE_PATH = '/usage-insights/snapshot'
const PER_MILLION = 1_000_000

/** USD per 1M tokens. Estimates only; override through the plugin config. */
const DEFAULT_PRICE = Object.freeze({
  input: 0.28,
  cachedInput: 0.028,
  cacheWrite: 0.28,
  output: 0.42,
})

const DEFAULT_PRICING = Object.freeze({
  'deepseek-flash': DEFAULT_PRICE,
  'deepseek-v4-flash': DEFAULT_PRICE,
  'deepseek-chat': DEFAULT_PRICE,
  'deepseek-reasoner': DEFAULT_PRICE,
})

const DEFAULTS = Object.freeze({
  budgetUsd: 20,
  refreshMs: 5000,
  timelineDays: 30,
  fullRefreshMs: 300000,
  liveRefreshMs: 10000,
  includeSubagents: true,
  cpuSampleMs: 2000,
})

function finiteNumber(value, fallback, min = 0) {
  const n = Number(value)
  return Number.isFinite(n) && n >= min ? n : fallback
}

function normalizePrice(raw, base) {
  const source = raw && typeof raw === 'object' ? raw : {}
  const pick = (key) => finiteNumber(source[key], base[key], 0)
  return {
    input: pick('input'),
    cachedInput: pick('cachedInput'),
    cacheWrite: pick('cacheWrite'),
    output: pick('output'),
  }
}

function normalizeConfig(config) {
  const raw = config && typeof config === 'object' ? config : {}
  const pricing = {}
  for (const [model, price] of Object.entries(DEFAULT_PRICING)) {
    pricing[model] = normalizePrice(price, DEFAULT_PRICE)
  }
  if (raw.pricing && typeof raw.pricing === 'object') {
    for (const [model, price] of Object.entries(raw.pricing)) {
      if (!model || !price || typeof price !== 'object') continue
      pricing[model] = normalizePrice(price, DEFAULT_PRICE)
    }
  }
  return {
    budgetUsd: finiteNumber(raw.budgetUsd, DEFAULTS.budgetUsd, 0),
    refreshMs: Math.max(2000, Math.floor(finiteNumber(raw.refreshMs, DEFAULTS.refreshMs, 2000))),
    timelineDays: Math.min(90, Math.max(7, Math.floor(finiteNumber(raw.timelineDays, DEFAULTS.timelineDays, 7)))),
    fullRefreshMs: Math.max(30000, Math.floor(finiteNumber(raw.fullRefreshMs, DEFAULTS.fullRefreshMs, 30000))),
    liveRefreshMs: Math.max(3000, Math.floor(finiteNumber(raw.liveRefreshMs, DEFAULTS.liveRefreshMs, 3000))),
    includeSubagents: raw.includeSubagents !== false,
    cpuSampleMs: Math.max(1000, Math.floor(finiteNumber(raw.cpuSampleMs, DEFAULTS.cpuSampleMs, 1000))),
    defaultPrice: normalizePrice(raw.defaultPrice, DEFAULT_PRICE),
    pricing,
  }
}

function emptyTokens() {
  return {
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    reasoningTokens: 0,
    totalTokens: 0,
  }
}

function addUsage(target, usage) {
  if (!usage || typeof usage !== 'object') return false
  const input = finiteNumber(usage.inputTokens, 0, 0)
  const output = finiteNumber(usage.outputTokens, 0, 0)
  const cacheRead = finiteNumber(usage.cacheReadTokens, 0, 0)
  const cacheWrite = finiteNumber(usage.cacheWriteTokens, 0, 0)
  const reasoning = finiteNumber(usage.reasoningTokens, 0, 0)
  if (input + output + cacheRead + cacheWrite + reasoning <= 0) return false
  target.inputTokens += input
  target.outputTokens += output
  target.cacheReadTokens += cacheRead
  target.cacheWriteTokens += cacheWrite
  target.reasoningTokens += reasoning
  // Reasoning tokens are a subset of output; do not count them twice.
  target.totalTokens += input + output + cacheRead + cacheWrite
  return true
}

function priceFor(model, config) {
  const wanted = String(model || '').toLowerCase()
  for (const [name, price] of Object.entries(config.pricing)) {
    if (name.toLowerCase() === wanted) return price
  }
  return config.defaultPrice
}

function costOfTokens(tokens, price) {
  return (
    (tokens.inputTokens * price.input +
      tokens.cacheReadTokens * price.cachedInput +
      tokens.cacheWriteTokens * price.cacheWrite +
      tokens.outputTokens * price.output) /
    PER_MILLION
  )
}

function roundCost(value) {
  if (!Number.isFinite(value)) return 0
  return Math.round(value * 1_000_000) / 1_000_000
}

function localDateKey(time) {
  const date = new Date(time)
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

function trimText(text, limit) {
  const clean = String(text || '').replace(/\s+/g, ' ').trim()
  if (clean.length <= limit) return clean
  return `${clean.slice(0, limit - 1)}…`
}

function extractText(content) {
  if (!Array.isArray(content)) return ''
  const parts = []
  for (const block of content) {
    if (block && block.type === 'text' && typeof block.text === 'string') parts.push(block.text)
  }
  return parts.join(' ')
}

function emptyEntry(record) {
  const header = record && record.header ? record.header : {}
  return {
    id: String(header.id || ''),
    title: '',
    cwd: typeof header.cwd === 'string' ? header.cwd : '',
    createdAt: finiteNumber(header.createdAt, 0, 0),
    origin: header.origin === 'subagent' ? 'subagent' : 'main',
    parentSession: typeof header.parentSession === 'string' ? header.parentSession : null,
    agentPreset: typeof header.agentPreset === 'string' ? header.agentPreset : null,
    live: Boolean(record && record.live),
    persisted: Boolean(record && record.persisted),
    builtAt: 0,
    turns: 0,
    messages: 0,
    firstActivityAt: 0,
    lastActivityAt: 0,
    tokens: emptyTokens(),
    costUsd: 0,
    models: {},
    daily: {},
    readError: null,
  }
}

function emptyModel() {
  return { calls: 0, provider: '', ...emptyTokens(), costUsd: 0 }
}

async function pool(items, limit, worker) {
  let next = 0
  const runners = []
  const size = Math.max(1, Math.min(limit, items.length))
  for (let i = 0; i < size; i += 1) {
    runners.push(
      (async () => {
        for (;;) {
          const index = next
          next += 1
          if (index >= items.length) return
          await worker(items[index], index)
        }
      })(),
    )
  }
  await Promise.all(runners)
}

function readCpuTimes() {
  const cpus = os.cpus() || []
  let idle = 0
  let total = 0
  const perCore = []
  for (const cpu of cpus) {
    const times = cpu && cpu.times ? cpu.times : {}
    const coreTotal =
      finiteNumber(times.user, 0, 0) +
      finiteNumber(times.nice, 0, 0) +
      finiteNumber(times.sys, 0, 0) +
      finiteNumber(times.idle, 0, 0) +
      finiteNumber(times.irq, 0, 0)
    const coreIdle = finiteNumber(times.idle, 0, 0)
    idle += coreIdle
    total += coreTotal
    perCore.push({ idle: coreIdle, total: coreTotal })
  }
  return { at: Date.now(), idle, total, perCore, proc: process.cpuUsage() }
}

function readSystemFacts() {
  const memory = process.memoryUsage()
  const totalMem = os.totalmem()
  const freeMem = os.freemem()
  const load = os.loadavg()
  return {
    memory: {
      rssBytes: memory.rss,
      heapUsedBytes: memory.heapUsed,
      heapTotalBytes: memory.heapTotal,
    },
    system: {
      totalMemBytes: totalMem,
      freeMemBytes: freeMem,
      usedMemRatio: totalMem > 0 ? 1 - freeMem / totalMem : 0,
      load1: finiteNumber(load[0], 0, 0),
      load5: finiteNumber(load[1], 0, 0),
      load15: finiteNumber(load[2], 0, 0),
      cpuCount: (os.cpus() || []).length,
      platform: os.platform(),
      arch: os.arch(),
      uptimeSeconds: os.uptime(),
    },
    process: {
      pid: process.pid,
      uptimeSeconds: process.uptime(),
      ...memory,
    },
  }
}

function createCpuSampler(intervalMs) {
  let latest = null
  let previous = readCpuTimes()

  function sample() {
    const current = readCpuTimes()
    const elapsedMs = Math.max(1, current.at - previous.at)
    const totalDelta = current.total - previous.total
    const idleDelta = current.idle - previous.idle
    const systemPercent = totalDelta > 0 ? Math.max(0, Math.min(100, (1 - idleDelta / totalDelta) * 100)) : 0
    const procDelta = {
      user: Math.max(0, current.proc.user - previous.proc.user),
      system: Math.max(0, current.proc.system - previous.proc.system),
    }
    const cpuCount = Math.max(1, (os.cpus() || []).length)
    const processPercent = Math.max(0, (procDelta.user + procDelta.system) / 1000 / elapsedMs * 100)
    const perCore = current.perCore.map((core, index) => {
      const before = previous.perCore[index] || { idle: 0, total: 0 }
      const coreTotal = core.total - before.total
      const coreIdle = core.idle - before.idle
      return {
        index,
        percent: coreTotal > 0 ? Math.max(0, Math.min(100, (1 - coreIdle / coreTotal) * 100)) : 0,
      }
    })
    previous = current
    const facts = readSystemFacts()
    latest = {
      sampledAt: current.at,
      windowMs: elapsedMs,
      cpuCount: facts.system.cpuCount,
      process: {
        ...facts.process,
        percentOfCore: Math.round(processPercent * 10) / 10,
        percentOfMachine: Math.round((processPercent / cpuCount) * 10) / 10,
      },
      system: {
        ...facts.system,
        percent: Math.round(systemPercent * 10) / 10,
        perCore: perCore.map((core) => ({ ...core, percent: Math.round(core.percent * 10) / 10 })),
      },
    }
    return latest
  }

  // Seed a first reading immediately so the first client poll is never empty.
  sample()
  return {
    read() {
      return latest
    },
    start(set) {
      const timer = setInterval(() => {
        try {
          set(sample())
        } catch {
          // A metrics sample must never take down the route.
        }
      }, intervalMs)
      if (typeof timer.unref === 'function') timer.unref()
      return () => clearInterval(timer)
    },
  }
}

/**
 * @param ctx - Cordis context carrying `sessionQuery` and `webServer`.
 * @param config - plugin row config (budget, pricing, refresh cadence).
 */
export function apply(ctx, config) {
  const options = normalizeConfig(config)
  const cache = new Map()
  const cpu = createCpuSampler(options.cpuSampleMs)

  let latestCpu = cpu.read()
  let fullLoadedAt = 0
  let lastErrors = []
  let building = null

  ctx.effect(
    () => cpu.start((next) => { latestCpu = next }),
    'usage-insights: cpu sampler',
  )

  async function readEntry(record) {
    const entry = emptyEntry(record)
    const sessionId = entry.id
    let snapshot
    try {
      snapshot = await ctx.sessionQuery.readSession(sessionId)
    } catch (error) {
      throw new Error(error && error.message ? error.message : String(error))
    }
    const header = snapshot && snapshot.session ? snapshot.session : {}
    entry.title = ''
    entry.cwd = typeof header.cwd === 'string' ? header.cwd : entry.cwd
    entry.createdAt = finiteNumber(header.createdAt, entry.createdAt, 0)
    const inherited = finiteNumber(snapshot && snapshot.inheritedEventCount, 0, 0)
    const events = Array.isArray(snapshot && snapshot.events) ? snapshot.events : []
    let firstUserText = ''

    for (const event of events) {
      if (!event || typeof event !== 'object') continue
      const seq = finiteNumber(event.seq, 0, 0)
      if (seq < inherited) continue
      const type = event.type
      const time = finiteNumber(event.time, 0, 0)
      if (time > 0) {
        if (entry.firstActivityAt === 0 || time < entry.firstActivityAt) entry.firstActivityAt = time
        if (time > entry.lastActivityAt) entry.lastActivityAt = time
      }
      if (type === 'turn/start') {
        entry.turns += 1
        continue
      }
      if (type === 'session/title') {
        const data = event.data || {}
        if (typeof data.title === 'string' && data.title.trim()) entry.title = data.title.trim()
        continue
      }
      if (type === 'user/message' && !firstUserText) {
        firstUserText = trimText(extractText((event.data || {}).content), 120)
        continue
      }
      if (type !== 'assistant/message') continue

      const data = event.data || {}
      const usage = data.usage
      if (!usage || typeof usage !== 'object') continue
      const source = data.message && data.message.source ? data.message.source : {}
      const rawModel = typeof source.model === 'string' && source.model ? source.model : 'unknown'
      const provider = typeof source.provider === 'string' ? source.provider : ''
      const price = priceFor(rawModel, options)
      const before = emptyTokens()
      if (!addUsage(before, usage)) continue

      entry.messages += 1
      addUsage(entry.tokens, usage)
      entry.costUsd += costOfTokens(before, price)

      const model = entry.models[rawModel] || emptyModel()
      model.provider = model.provider || provider
      model.calls += 1
      addUsage(model, usage)
      model.costUsd += costOfTokens(before, price)
      entry.models[rawModel] = model

      const day = localDateKey(time || Date.now())
      const bucket = entry.daily[day] || { ...emptyTokens(), costUsd: 0, messages: 0 }
      addUsage(bucket, usage)
      bucket.costUsd += costOfTokens(before, price)
      bucket.messages += 1
      entry.daily[day] = bucket
    }

    if (!entry.title) {
      entry.title = firstUserText || 'Untitled session'
    }
    entry.costUsd = roundCost(entry.costUsd)
    for (const model of Object.values(entry.models)) model.costUsd = roundCost(model.costUsd)
    for (const bucket of Object.values(entry.daily)) bucket.costUsd = roundCost(bucket.costUsd)
    entry.builtAt = Date.now()
    entry.readError = null
    return entry
  }

  async function buildSnapshot() {
    const now = Date.now()
    let records = []
    try {
      records = await ctx.sessionQuery.listSessions()
    } catch (error) {
      throw new Error(`Unable to list sessions: ${error && error.message ? error.message : String(error)}`)
    }
    const knownIds = new Set()
    for (const record of records) {
      const id = String(record && record.header ? record.header.id : '')
      if (id) knownIds.add(id)
    }
    for (const id of [...cache.keys()]) {
      if (!knownIds.has(id)) cache.delete(id)
    }

    const stale = []
    const refreshAll = now - fullLoadedAt >= options.fullRefreshMs
    for (const record of records) {
      const id = String(record.header.id)
      const cached = cache.get(id)
      const needsRefresh =
        !cached ||
        refreshAll ||
        (record.live && now - cached.builtAt >= options.liveRefreshMs)
      if (needsRefresh) stale.push(record)
    }

    const errors = []
    await pool(stale, 4, async (record) => {
      const id = String(record.header.id)
      try {
        cache.set(id, await readEntry(record))
      } catch (error) {
        const previous = cache.get(id)
        const message = error && error.message ? error.message : String(error)
        errors.push({ sessionId: id, message: trimText(message, 240) })
        if (previous) {
          cache.set(id, { ...previous, readError: trimText(message, 240), live: Boolean(record.live) })
        } else {
          const fallback = emptyEntry(record)
          fallback.readError = trimText(message, 240)
          fallback.builtAt = Date.now()
          cache.set(id, fallback)
        }
      }
    })
    if (refreshAll) fullLoadedAt = now
    lastErrors = errors

    return composeSnapshot(records, latestCpu)
  }

  function composeSnapshot(records, cpuSnapshot) {
    const included = []
    for (const record of records) {
      const entry = cache.get(String(record.header.id))
      if (!entry) continue
      if (!options.includeSubagents && entry.origin === 'subagent') continue
      included.push({ ...entry, live: Boolean(record.live), persisted: Boolean(record.persisted) })
    }

    const totals = {
      sessions: included.length,
      liveSessions: included.filter((entry) => entry.live).length,
      subagentSessions: included.filter((entry) => entry.origin === 'subagent').length,
      messages: 0,
      turns: 0,
      ...emptyTokens(),
      costUsd: 0,
    }
    const models = {}
    const dayKeys = []
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    for (let offset = options.timelineDays - 1; offset >= 0; offset -= 1) {
      const day = new Date(today)
      day.setDate(day.getDate() - offset)
      dayKeys.push(localDateKey(day.getTime()))
    }
    const daily = {}
    for (const key of dayKeys) daily[key] = { date: key, ...emptyTokens(), costUsd: 0, messages: 0 }
    const unknownModels = new Set()

    const sessions = []
    for (const entry of included) {
      totals.messages += entry.messages
      totals.turns += entry.turns
      totals.inputTokens += entry.tokens.inputTokens
      totals.outputTokens += entry.tokens.outputTokens
      totals.cacheReadTokens += entry.tokens.cacheReadTokens
      totals.cacheWriteTokens += entry.tokens.cacheWriteTokens
      totals.reasoningTokens += entry.tokens.reasoningTokens
      totals.totalTokens += entry.tokens.totalTokens
      totals.costUsd += entry.costUsd

      for (const [modelName, value] of Object.entries(entry.models)) {
        if (!models[modelName]) models[modelName] = { model: modelName, provider: value.provider, calls: 0, ...emptyTokens(), costUsd: 0 }
        const target = models[modelName]
        target.calls += value.calls
        target.inputTokens += value.inputTokens
        target.outputTokens += value.outputTokens
        target.cacheReadTokens += value.cacheReadTokens
        target.cacheWriteTokens += value.cacheWriteTokens
        target.reasoningTokens += value.reasoningTokens
        target.totalTokens += value.totalTokens
        target.costUsd += value.costUsd
        const price = priceFor(modelName, options)
        if (price === options.defaultPrice && !Object.keys(options.pricing).some((name) => name.toLowerCase() === modelName.toLowerCase())) {
          unknownModels.add(modelName)
        }
      }

      for (const [key, bucket] of Object.entries(entry.daily)) {
        if (!daily[key]) continue
        daily[key].inputTokens += bucket.inputTokens
        daily[key].outputTokens += bucket.outputTokens
        daily[key].cacheReadTokens += bucket.cacheReadTokens
        daily[key].cacheWriteTokens += bucket.cacheWriteTokens
        daily[key].reasoningTokens += bucket.reasoningTokens
        daily[key].totalTokens += bucket.totalTokens
        daily[key].costUsd += bucket.costUsd
        daily[key].messages += bucket.messages
      }

      sessions.push({
        id: entry.id,
        title: entry.title || 'Untitled session',
        cwd: entry.cwd,
        createdAt: entry.createdAt,
        origin: entry.origin,
        parentSession: entry.parentSession,
        agentPreset: entry.agentPreset,
        live: entry.live,
        persisted: entry.persisted,
        turns: entry.turns,
        messages: entry.messages,
        firstActivityAt: entry.firstActivityAt,
        lastActivityAt: entry.lastActivityAt || entry.createdAt,
        tokens: { ...entry.tokens },
        costUsd: roundCost(entry.costUsd),
        models: Object.entries(entry.models).map(([model, value]) => ({
          model,
          provider: value.provider,
          calls: value.calls,
          totalTokens: value.totalTokens,
          costUsd: roundCost(value.costUsd),
        })),
        readError: entry.readError,
      })
    }

    sessions.sort((a, b) => (b.lastActivityAt || 0) - (a.lastActivityAt || 0))
    totals.costUsd = roundCost(totals.costUsd)
    const timeline = dayKeys.map((key) => {
      const row = daily[key]
      return {
        ...row,
        totalTokens: row.inputTokens + row.outputTokens + row.cacheReadTokens + row.cacheWriteTokens,
        costUsd: roundCost(row.costUsd),
      }
    })
    const modelRows = Object.values(models)
      .map((row) => ({ ...row, costUsd: roundCost(row.costUsd) }))
      .sort((a, b) => b.totalTokens - a.totalTokens)

    const errors = []
    const errorIds = new Set()
    for (const session of sessions) {
      if (!session.readError || errorIds.has(session.id)) continue
      errorIds.add(session.id)
      errors.push({ sessionId: session.id, message: session.readError })
    }
    for (const error of lastErrors) {
      if (errorIds.has(error.sessionId)) continue
      errorIds.add(error.sessionId)
      errors.push(error)
    }

    const todayKey = localDateKey(Date.now())
    const todayRow = daily[todayKey] || null
    const recent = timeline.slice(-7)
    const recentCost = recent.reduce((sum, row) => sum + row.costUsd, 0)
    const avgDayUsd = roundCost(recentCost / Math.max(1, recent.length))
    const remainingUsd = Math.max(0, options.budgetUsd - totals.costUsd)
    const usedRatio = options.budgetUsd > 0 ? totals.costUsd / options.budgetUsd : 0

    return {
      version: 1,
      generatedAt: Date.now(),
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      refreshMs: options.refreshMs,
      totals: {
        ...totals,
        costUsd: roundCost(totals.costUsd),
      },
      budget: {
        budgetUsd: options.budgetUsd,
        spentUsd: roundCost(totals.costUsd),
        remainingUsd: roundCost(remainingUsd),
        usedRatio: Math.round(usedRatio * 10000) / 10000,
        todayUsd: todayRow ? roundCost(todayRow.costUsd) : 0,
        avgDayUsd,
        projected30Usd: roundCost(avgDayUsd * 30),
        daysRemaining: avgDayUsd > 0 ? Math.round((remainingUsd / avgDayUsd) * 10) / 10 : null,
      },
      models: modelRows,
      sessions,
      timeline,
      pricing: {
        currency: 'USD',
        unit: 'per 1M tokens',
        models: options.pricing,
        default: options.defaultPrice,
      },
      unknownModels: [...unknownModels],
      errors: lastErrors,
      cpu: cpuSnapshot,
    }
  }

  function getSnapshot() {
    if (building) return building
    building = buildSnapshot().finally(() => {
      building = null
    })
    return building
  }

  async function handle(req, res) {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405, { allow: 'GET, HEAD', 'content-type': 'text/plain; charset=utf-8' })
      res.end('Method Not Allowed')
      return
    }
    const headers = {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
    }
    try {
      const snapshot = await getSnapshot()
      const body = JSON.stringify(snapshot)
      if (req.method === 'HEAD') {
        res.writeHead(200, { ...headers, 'content-length': Buffer.byteLength(body) })
        res.end()
        return
      }
      res.writeHead(200, headers)
      res.end(body)
    } catch (error) {
      const body = JSON.stringify({ error: error && error.message ? error.message : String(error) })
      res.writeHead(500, headers)
      res.end(body)
    }
  }

  ctx.effect(
    () => ctx.webServer.register({ kind: 'exact', path: ROUTE_PATH, handler: handle }),
    'usage-insights: snapshot route',
  )
}

export const inject = ['sessionQuery', 'webServer']
export const name = 'usage-insights'
