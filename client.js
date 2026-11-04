/**
 * Client half of the Usage Insights bundle.
 *
 * Renders one Settings section that reads the Host's read-only snapshot route
 * and presents totals, estimated cost/budget, a daily consumption timeline,
 * per-session usage, and live CPU/memory samples.
 */
window.__ModuleLoader__.load({
  id: 'dsh-usage-insights',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const { useEffect, useMemo, useRef, useState } = React

    const NS = 'usage-insights'
    const ENDPOINT = '/usage-insights/snapshot'

    const TEXT = {
      zh: {
        nav: '用量统计',
        title: '用量统计',
        subtitle: '基于本机真实会话日志统计 · 成本按配置单价估算',
        refresh: '刷新',
        updated: '更新于',
        loading: '正在读取会话数据…',
        errorTitle: '无法读取统计数据',
        retry: '重试',
        totalTokens: '总 Token',
        sessions: '会话数',
        estCost: '估算成本',
        budgetLeft: '预算剩余',
        input: '输入',
        cache: '缓存读取',
        output: '输出',
        cacheWrite: '缓存写入',
        reasoning: '推理',
        subagent: '子会话',
        avgPerDay: '平均',
        perDay: '/ 天',
        budgetOf: '预算',
        used: '已用',
        overBudget: '已超预算',
        today: '今日',
        projected: '按近 7 天速度，30 天约',
        daysLeft: '预计可用',
        days: '天',
        timeline: 'Token 消耗时间线',
        tokens: 'Token 总量',
        outputOnly: '输出 Token',
        cost: '成本',
        range: '范围',
        sessionsTitle: '各会话用量与成本',
        search: '搜索会话标题、目录或 ID',
        prev: '上一页',
        next: '下一页',
        session: '会话',
        model: '模型',
        lastActive: '最近活动',
        breakdown: 'Token 明细',
        cwd: '工作目录',
        provider: '提供商',
        sessionId: '会话 ID',
        parent: '父会话',
        readError: '读取失败',
        noSessions: '没有匹配的会话',
        noUsage: '暂无用量数据',
        cpuTitle: 'CPU 与进程监测',
        cpuHint: '每 2 秒采样一次',
        processCpu: '进程 CPU',
        systemCpu: '系统 CPU',
        load: '负载 (1/5/15)',
        memory: '内存',
        uptime: '运行时长',
        ofOneCore: '单核占用',
        machine: '整机占比',
        cores: '核心',
        core: '核心',
        pid: '进程',
        recent: '最近采样',
        footnote: '成本为按 Token 用量与下方单价的估算值，不代表实际账单。',
        pricing: '估算单价（USD / 百万 Token）',
        priceInput: '输入',
        priceCache: '缓存读取',
        priceOutput: '输出',
        priceDefault: '默认',
        changeHint: '可在插件配置中调整 budgetUsd、pricing 与刷新频率。',
        unknownModels: '未匹配单价的模型：',
        errors: '个会话读取失败',
        tokensUnit: 'Token',
      },
      en: {
        nav: 'Usage Stats',
        title: 'Usage stats',
        subtitle: 'Computed from real local session logs · cost is an estimate at configured rates',
        refresh: 'Refresh',
        updated: 'Updated',
        loading: 'Reading session data…',
        errorTitle: 'Could not load statistics',
        retry: 'Retry',
        totalTokens: 'Total tokens',
        sessions: 'Sessions',
        estCost: 'Estimated cost',
        budgetLeft: 'Budget left',
        input: 'Input',
        cache: 'Cache read',
        output: 'Output',
        cacheWrite: 'Cache write',
        reasoning: 'Reasoning',
        subagent: 'sub-agent',
        avgPerDay: 'Avg',
        perDay: '/ day',
        budgetOf: 'Budget',
        used: 'used',
        overBudget: 'Over budget',
        today: 'Today',
        projected: 'At the last 7 days’ pace, ~30 days',
        daysLeft: 'Remaining',
        days: 'days',
        timeline: 'Token consumption timeline',
        tokens: 'Total tokens',
        outputOnly: 'Output tokens',
        cost: 'Cost',
        range: 'Range',
        sessionsTitle: 'Usage and cost by session',
        search: 'Search title, directory, or ID',
        prev: 'Previous page',
        next: 'Next page',
        session: 'Session',
        model: 'Model',
        lastActive: 'Last active',
        breakdown: 'Token breakdown',
        cwd: 'Working directory',
        provider: 'Provider',
        sessionId: 'Session ID',
        parent: 'Parent session',
        readError: 'Read failed',
        noSessions: 'No matching sessions',
        noUsage: 'No usage yet',
        cpuTitle: 'CPU & process monitor',
        cpuHint: 'sampled every 2 seconds',
        processCpu: 'Process CPU',
        systemCpu: 'System CPU',
        load: 'Load (1/5/15)',
        memory: 'Memory',
        uptime: 'Uptime',
        ofOneCore: 'of one core',
        machine: 'of machine',
        cores: 'cores',
        core: 'Core',
        pid: 'PID',
        recent: 'recent samples',
        footnote: 'Cost is estimated from token usage and the rates below; it is not a bill.',
        pricing: 'Estimated rates (USD per 1M tokens)',
        priceInput: 'Input',
        priceCache: 'Cache read',
        priceOutput: 'Output',
        priceDefault: 'Default',
        changeHint: 'Adjust budgetUsd, pricing, and refresh cadence in the plugin config.',
        unknownModels: 'Models without a matching rate:',
        errors: 'session(s) failed to read',
        tokensUnit: 'tokens',
      },
    }

    const CSS = `
.ui-root { display: flex; flex-direction: column; gap: 16px; width: 100%; max-width: 1120px; margin: 0 auto; box-sizing: border-box; padding: 0 28px 48px; color: var(--dsw-alias-label-primary); font-size: 13px; line-height: 1.5; height: 100%; min-height: 0; overflow-y: auto; overscroll-behavior: contain; }
.ui-root > * { flex: none; }
.ui-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; flex-wrap: wrap; padding-top: 24px; }
.ui-title { margin: 0; font-size: 20px; font-weight: 600; letter-spacing: -0.01em; }
.ui-sub { margin: 4px 0 0; color: var(--dsw-alias-label-secondary); font-size: 12px; }
.ui-head-actions { display: flex; align-items: center; gap: 10px; color: var(--dsw-alias-label-secondary); font-size: 12px; }
.ui-btn { appearance: none; border: 1px solid var(--dsw-alias-border-l1); background: var(--dsw-alias-bg-layer-1); color: var(--dsw-alias-label-primary); border-radius: 7px; padding: 5px 11px; font: inherit; font-size: 12px; cursor: pointer; }
.ui-btn:hover { border-color: var(--dsw-alias-border-l2); }
.ui-btn:focus-visible { outline: 2px solid var(--dsw-alias-brand-primary); outline-offset: 1px; }
.ui-seg { display: inline-flex; border: 1px solid var(--dsw-alias-border-l1); border-radius: 7px; overflow: hidden; background: var(--dsw-alias-bg-layer-1); }
.ui-seg button { appearance: none; border: 0; background: transparent; color: var(--dsw-alias-label-secondary); font: inherit; font-size: 12px; padding: 4px 9px; cursor: pointer; }
.ui-seg button + button { border-left: 1px solid var(--dsw-alias-border-l1); }
.ui-seg button.is-active { background: var(--dsw-alias-brand-primary); color: var(--dsw-alias-bg-base); }
.ui-kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(148px, 1fr)); gap: 10px; }
.ui-kpi { border: 1px solid var(--dsw-alias-border-l1); background: var(--dsw-alias-bg-layer-1); border-radius: 11px; padding: 12px 14px; min-width: 0; }
.ui-kpi-label { color: var(--dsw-alias-label-secondary); font-size: 12px; }
.ui-kpi-value { font-size: 24px; font-weight: 600; letter-spacing: -0.02em; margin-top: 4px; font-variant-numeric: tabular-nums; }
.ui-kpi-sub { color: var(--dsw-alias-label-secondary); font-size: 11px; margin-top: 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ui-card { border: 1px solid var(--dsw-alias-border-l1); background: var(--dsw-alias-bg-layer-1); border-radius: 11px; padding: 14px 16px; min-width: 0; }
.ui-card-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 12px; flex-wrap: wrap; }
.ui-card-title { margin: 0; font-size: 13px; font-weight: 600; }
.ui-muted { color: var(--dsw-alias-label-secondary); }
.ui-num { font-variant-numeric: tabular-nums; white-space: nowrap; }
.ui-progress { position: relative; height: 9px; border-radius: 999px; background: var(--dsw-alias-bg-layer-2); overflow: hidden; }
.ui-progress-fill { height: 100%; border-radius: 999px; transition: width 240ms ease; }
.ui-budget-line { display: flex; justify-content: space-between; gap: 12px; margin-top: 8px; flex-wrap: wrap; font-size: 12px; }
.ui-budget-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(110px, 1fr)); gap: 10px; margin-top: 12px; }
.ui-budget-cell { background: var(--dsw-alias-bg-layer-2); border-radius: 8px; padding: 8px 10px; }
.ui-budget-cell b { display: block; font-size: 15px; font-weight: 600; margin-top: 2px; font-variant-numeric: tabular-nums; }
.ui-chart { display: grid; grid-template-columns: 46px minmax(0, 1fr); grid-template-rows: 168px 18px; column-gap: 10px; margin-top: 4px; }
.ui-axis { position: relative; grid-column: 1; grid-row: 1; min-height: 0; }
.ui-axis-label { position: absolute; right: 0; transform: translateY(50%); color: var(--dsw-alias-label-secondary); font-size: 10px; line-height: 1; font-variant-numeric: tabular-nums; white-space: nowrap; }
.ui-axis-label.is-zero { transform: none; }
.ui-plot { position: relative; grid-column: 2; grid-row: 1; min-width: 0; border-bottom: 1px solid var(--dsw-alias-border-l1); }
.ui-grid-line { position: absolute; left: 0; right: 0; border-top: 1px dashed var(--dsw-alias-border-l1); opacity: .7; }
.ui-bars { position: absolute; inset: 0; display: flex; align-items: flex-end; gap: 4px; }
.ui-bar-col { position: relative; flex: 1 1 0; min-width: 0; height: 100%; display: flex; align-items: flex-end; }
.ui-bar-track { width: 100%; height: 100%; display: flex; flex-direction: column; justify-content: flex-end; }
.ui-bar-seg { width: 100%; max-width: 52px; margin: 0 auto; }
.ui-bar-seg.is-cap { border-radius: 3px 3px 0 0; }
.ui-bar-seg.cache { background: var(--dsw-alias-brand-primary); opacity: .32; }
.ui-bar-seg.input { background: var(--dsw-alias-brand-primary); opacity: .62; }
.ui-bar-seg.output { background: var(--dsw-alias-state-success-primary); }
.ui-bar-seg.cost { background: var(--dsw-alias-state-warn-primary); }
.ui-dates { grid-column: 2; grid-row: 2; display: flex; align-items: flex-start; gap: 4px; padding-top: 5px; }
.ui-date { position: relative; flex: 1 1 0; min-width: 0; display: flex; justify-content: center; color: var(--dsw-alias-label-secondary); font-size: 10px; line-height: 1.2; font-variant-numeric: tabular-nums; white-space: nowrap; }
.ui-date.is-today { color: var(--dsw-alias-label-primary); font-weight: 600; }
.ui-date.is-today::after { content: ''; position: absolute; left: 50%; bottom: -4px; width: 12px; height: 2px; margin-left: -6px; border-radius: 1px; background: var(--dsw-alias-brand-primary); }
.ui-tip { display: none; position: absolute; z-index: 8; left: 50%; transform: translateX(-50%); bottom: min(calc(var(--bar, 0%) + 10px), calc(100% - 118px)); width: 168px; box-sizing: border-box; padding: 8px 10px; border: 1px solid var(--dsw-alias-border-l1); border-radius: 8px; background: var(--dsw-alias-bg-layer-1); box-shadow: 0 8px 24px rgba(0, 0, 0, .16); pointer-events: none; text-align: left; }
.ui-bar-col:hover .ui-tip { display: block; }
.ui-bar-col:first-child .ui-tip { left: 0; transform: none; }
.ui-bar-col:last-child .ui-tip { left: auto; right: 0; transform: none; }
.ui-tip-head { margin-bottom: 5px; color: var(--dsw-alias-label-primary); font-size: 11px; font-weight: 600; }
.ui-tip-row { display: flex; align-items: center; gap: 6px; color: var(--dsw-alias-label-secondary); font-size: 11px; line-height: 16px; }
.ui-tip-row b { margin-left: auto; color: var(--dsw-alias-label-primary); font-weight: 500; font-variant-numeric: tabular-nums; }
.ui-tip-spacer { width: 8px; flex: none; }
.ui-legend { display: flex; gap: 14px; flex-wrap: wrap; color: var(--dsw-alias-label-secondary); font-size: 11px; margin-top: 10px; }
.ui-legend span { display: inline-flex; align-items: center; gap: 5px; }
.ui-dot { width: 8px; height: 8px; border-radius: 2px; display: inline-block; background: var(--dsw-alias-brand-primary); }
.ui-dot.cache { opacity: .32; }
.ui-dot.input { opacity: .62; }
.ui-dot.output { background: var(--dsw-alias-state-success-primary); }
.ui-dot.cost { background: var(--dsw-alias-state-warn-primary); }
.ui-table-wrap { margin: 0 -4px; }
.ui-table { width: 100%; table-layout: fixed; border-collapse: separate; border-spacing: 0; font-size: 12px; min-width: 560px; }
.ui-table th { position: sticky; top: 0; z-index: 1; text-align: left; font-weight: 500; color: var(--dsw-alias-label-secondary); padding: 6px 8px; border-bottom: 1px solid var(--dsw-alias-border-l1); background: var(--dsw-alias-bg-layer-1); white-space: nowrap; }
.ui-table th.ui-sortable { cursor: pointer; user-select: none; }
.ui-table th.ui-sortable:hover { color: var(--dsw-alias-label-primary); }
.ui-table td { padding: 8px; border-bottom: 1px solid var(--dsw-alias-border-l1); vertical-align: top; }
.ui-table tr:last-child td { border-bottom: 0; }
.ui-pager { display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; margin-top: 12px; }
.ui-pager-info { color: var(--dsw-alias-label-secondary); font-size: 11px; font-variant-numeric: tabular-nums; }
.ui-pager-pages { display: flex; align-items: center; gap: 4px; }
.ui-pager .ui-btn { min-width: 26px; padding: 3px 7px; font-size: 11px; line-height: 16px; text-align: center; font-variant-numeric: tabular-nums; }
.ui-pager .ui-btn:disabled { opacity: .45; cursor: default; }
.ui-pager .ui-pager-step { padding: 3px 8px; font-size: 14px; line-height: 16px; }
.ui-pager .ui-btn:disabled:hover { border-color: var(--dsw-alias-border-l1); }
.ui-pager-page.is-current { background: var(--dsw-alias-brand-primary); border-color: var(--dsw-alias-brand-primary); color: var(--dsw-alias-bg-base); }
.ui-pager-page.is-current:hover { border-color: var(--dsw-alias-brand-primary); }
.ui-pager-gap { padding: 0 2px; color: var(--dsw-alias-label-secondary); font-size: 11px; }
.ui-row { cursor: pointer; }
.ui-row:hover td { background: var(--dsw-alias-bg-layer-2); }
.ui-row:focus-visible { outline: 1px solid var(--dsw-alias-brand-primary); outline-offset: -1px; }
.ui-session-title { display: flex; align-items: center; gap: 6px; font-weight: 500; min-width: 0; }
.ui-session-name { max-width: 280px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ui-badge { border: 1px solid var(--dsw-alias-border-l1); color: var(--dsw-alias-label-secondary); border-radius: 999px; padding: 0 6px; font-size: 10px; line-height: 16px; white-space: nowrap; }
.ui-badge-error { color: var(--dsw-alias-state-error-primary); border-color: var(--dsw-alias-state-error-primary); }
.ui-ellipsis { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 340px; }
.ui-search { width: 100%; box-sizing: border-box; border: 1px solid var(--dsw-alias-border-l1); background: var(--dsw-alias-bg-base); color: var(--dsw-alias-label-primary); border-radius: 7px; padding: 6px 9px; font: inherit; font-size: 12px; }
.ui-search:focus-visible { outline: 2px solid var(--dsw-alias-brand-primary); outline-offset: 1px; }
.ui-detail { background: var(--dsw-alias-bg-layer-2); border-radius: 8px; padding: 10px 12px; display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px 18px; font-size: 11px; }
.ui-detail dt { color: var(--dsw-alias-label-secondary); }
.ui-detail dd { margin: 2px 0 0; word-break: break-all; }
.ui-detail-full { grid-column: 1 / -1; }
.ui-error-banner { border: 1px solid var(--dsw-alias-state-error-primary); color: var(--dsw-alias-state-error-primary); border-radius: 9px; padding: 8px 11px; font-size: 12px; display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.ui-warn-banner { border: 1px solid var(--dsw-alias-state-warn-primary); color: var(--dsw-alias-state-warn-primary); border-radius: 9px; padding: 8px 11px; font-size: 12px; }
.ui-cpu-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 10px; }
.ui-cpu-cell { background: var(--dsw-alias-bg-layer-2); border-radius: 9px; padding: 9px 11px; }
.ui-cpu-cell b { display: block; font-size: 19px; font-weight: 600; margin-top: 2px; font-variant-numeric: tabular-nums; }
.ui-spark { width: 100%; height: 64px; display: block; margin-top: 12px; }
.ui-cores { display: flex; gap: 4px; flex-wrap: wrap; margin-top: 10px; }
.ui-core { width: 30px; text-align: center; color: var(--dsw-alias-label-secondary); font-size: 9px; }
.ui-core-track { height: 34px; background: var(--dsw-alias-bg-layer-2); border-radius: 3px; display: flex; align-items: flex-end; overflow: hidden; margin-bottom: 3px; }
.ui-core-fill { width: 100%; background: var(--dsw-alias-brand-primary); border-radius: 3px 3px 0 0; }
.ui-cores-head { display: flex; justify-content: space-between; color: var(--dsw-alias-label-secondary); font-size: 11px; margin-top: 12px; }
.ui-details { padding: 0; }
.ui-details summary { cursor: pointer; padding: 12px 16px; font-size: 12px; font-weight: 500; }
.ui-details-body { padding: 0 16px 14px; }
.ui-price-table { width: 100%; border-collapse: collapse; font-size: 11px; margin-top: 8px; }
.ui-price-table th, .ui-price-table td { text-align: right; padding: 4px 6px; border-bottom: 1px solid var(--dsw-alias-border-l1); }
.ui-price-table th:first-child, .ui-price-table td:first-child { text-align: left; }
.ui-footnote { color: var(--dsw-alias-label-secondary); font-size: 11px; margin: 0; }
.ui-empty { color: var(--dsw-alias-label-secondary); font-size: 12px; padding: 18px 0; text-align: center; }
.ui-loading { color: var(--dsw-alias-label-secondary); font-size: 12px; padding: 28px 0; text-align: center; }
@media (max-width: 640px) {
  .ui-root { padding: 0 16px 32px; }
  .ui-head { padding-top: 16px; }
  .ui-kpi-value { font-size: 20px; }
  .ui-chart { grid-template-columns: 34px minmax(0, 1fr); grid-template-rows: 148px 18px; column-gap: 6px; }
  .ui-axis-label, .ui-date { font-size: 9px; }
  .ui-table-wrap { overflow-x: auto; }
}
`

    function numberText(value) {
      return new Intl.NumberFormat('en-US').format(Number(value) || 0)
    }

    function fmtTokens(value) {
      const n = Number(value)
      if (!Number.isFinite(n)) return '—'
      if (n === 0) return '0'
      if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B'
      if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M'
      if (n >= 1e3) return (n / 1e3).toFixed(n >= 1e5 ? 0 : 1) + 'K'
      return String(Math.round(n))
    }

    function fmtUsd(value) {
      const n = Number(value)
      if (!Number.isFinite(n)) return '—'
      if (n === 0) return '$0.00'
      if (n < 0) return '—'
      if (n < 0.01) return '<$0.01'
      if (n < 1) return '$' + n.toFixed(3)
      if (n < 100) return '$' + n.toFixed(2)
      return '$' + n.toFixed(1)
    }

    function fmtPrice(value) {
      const n = Number(value)
      if (!Number.isFinite(n)) return '—'
      return '$' + n.toFixed(3)
    }

    const TOKEN_STEPS = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]
    const MONEY_STEPS = [1, 2, 2.5, 5, 10]
    const SESSIONS_PER_PAGE = 10

    function niceStep(raw, steps) {
      if (!(raw > 0) || !Number.isFinite(raw)) return 1
      const base = Math.pow(10, Math.floor(Math.log10(raw)))
      const ratio = raw / base
      for (let index = 0; index < steps.length; index += 1) {
        if (ratio <= steps[index]) return steps[index] * base
      }
      return 10 * base
    }

    function axisScale(max, metric) {
      if (!(max > 0) || !Number.isFinite(max)) return { top: 0, ticks: [] }
      const step = niceStep(max / 4, metric === 'cost' ? MONEY_STEPS : TOKEN_STEPS)
      return { top: step * 4, ticks: [0, step, step * 2, step * 3, step * 4] }
    }

    function fmtAxisValue(value, metric) {
      const n = Number(value)
      if (!Number.isFinite(n)) return '—'
      if (metric === 'cost') return '$' + n.toFixed(2)
      if (n <= 0) return '0'
      const brief = (part) => String(Math.round(part * 10) / 10)
      if (n >= 1e9) return brief(n / 1e9) + 'B'
      if (n >= 1e6) return brief(n / 1e6) + 'M'
      if (n >= 1e3) return brief(n / 1e3) + 'K'
      return String(Math.round(n))
    }

    function pageWindow(current, total) {
      if (total <= 7) return Array.from({ length: total }, (_, index) => index + 1)
      const items = [1]
      const start = Math.max(2, current - 2)
      const end = Math.min(total - 1, current + 2)
      if (start > 2) items.push('gap-start')
      for (let page = start; page <= end; page += 1) items.push(page)
      if (end < total - 1) items.push('gap-end')
      items.push(total)
      return items
    }

    function monthDay(date) {
      return typeof date === 'string' && date.length >= 10 ? date.slice(5).replace('-', '/') : ''
    }

    function localDayKey(time) {
      const date = new Date(time)
      return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0')
    }

    function fmtPercent(value) {
      const n = Number(value)
      if (!Number.isFinite(n)) return '—'
      return (Math.round(n * 10) / 10).toFixed(1) + '%'
    }

    function fmtBytes(value) {
      const n = Number(value)
      if (!Number.isFinite(n) || n < 0) return '—'
      if (n >= 1024 ** 3) return (n / 1024 ** 3).toFixed(1) + ' GB'
      if (n >= 1024 ** 2) return (n / 1024 ** 2).toFixed(0) + ' MB'
      if (n >= 1024) return (n / 1024).toFixed(0) + ' KB'
      return Math.round(n) + ' B'
    }

    function fmtDuration(seconds) {
      const n = Number(seconds)
      if (!Number.isFinite(n) || n < 0) return '—'
      const days = Math.floor(n / 86400)
      const hours = Math.floor((n % 86400) / 3600)
      const minutes = Math.floor((n % 3600) / 60)
      if (days > 0) return days + 'd ' + hours + 'h'
      if (hours > 0) return hours + 'h ' + minutes + 'm'
      return minutes + 'm'
    }

    function baseName(path) {
      if (!path || typeof path !== 'string') return ''
      const parts = path.split(/[\\/]+/).filter(Boolean)
      return parts.length ? parts[parts.length - 1] : path
    }

    function localeIsChinese(locale) {
      try {
        const snapshot = locale && locale.getSnapshot ? locale.getSnapshot() : null
        const active = snapshot && snapshot.active ? String(snapshot.active).toLowerCase() : ''
        return active.indexOf('zh') === 0
      } catch {
        return false
      }
    }

    function useLocaleRevision(locale) {
      const [revision, setRevision] = useState(0)
      useEffect(() => {
        if (!locale || typeof locale.subscribe !== 'function') return undefined
        const unsubscribe = locale.subscribe(() => setRevision((value) => value + 1))
        return typeof unsubscribe === 'function' ? unsubscribe : undefined
      }, [locale])
      return revision
    }

    function useSnapshot() {
      const [state, setState] = useState({ data: null, error: null, loading: true, updatedAt: 0 })
      const [nonce, setNonce] = useState(0)
      const refreshMs = state.data && Number(state.data.refreshMs) ? Number(state.data.refreshMs) : 5000

      useEffect(() => {
        let active = true
        let timer = null
        const load = async () => {
          try {
            const response = await fetch(ENDPOINT, {
              method: 'GET',
              headers: { accept: 'application/json' },
              cache: 'no-store',
            })
            if (!response.ok) throw new Error('HTTP ' + response.status)
            const data = await response.json()
            if (!active) return
            if (!data || typeof data !== 'object' || !data.totals) throw new Error('Malformed response')
            setState({ data, error: null, loading: false, updatedAt: Date.now() })
          } catch (error) {
            if (!active) return
            setState((previous) => ({
              data: previous.data,
              error: error && error.message ? error.message : String(error),
              loading: false,
              updatedAt: previous.updatedAt,
            }))
          }
        }
        load()
        timer = setInterval(load, Math.max(2000, refreshMs))
        return () => {
          active = false
          if (timer) clearInterval(timer)
        }
      }, [refreshMs, nonce])

      return { state, refresh: () => setNonce((value) => value + 1) }
    }

    function useDateFormats(chinese) {
      return useMemo(() => {
        const localeTag = chinese ? 'zh-CN' : 'en-US'
        return {
          dateTime: new Intl.DateTimeFormat(localeTag, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
          time: new Intl.DateTimeFormat(localeTag, { hour: '2-digit', minute: '2-digit' }),
          date: new Intl.DateTimeFormat(localeTag, { month: 'short', day: 'numeric' }),
        }
      }, [chinese])
    }

    function fmtDate(formats, time, withTime) {
      const ts = Number(time)
      if (!Number.isFinite(ts) || ts <= 0) return '—'
      try {
        return (withTime ? formats.dateTime : formats.date).format(new Date(ts))
      } catch {
        return new Date(ts).toISOString().slice(0, 16).replace('T', ' ')
      }
    }

    function Kpi(props) {
      return h(
        'div',
        { className: 'ui-kpi' },
        h('div', { className: 'ui-kpi-label' }, props.label),
        h('div', { className: 'ui-kpi-value', style: props.tone ? { color: props.tone } : undefined, title: props.exact || undefined }, props.value),
        props.sub ? h('div', { className: 'ui-kpi-sub', title: props.subTitle || undefined }, props.sub) : null,
      )
    }

    function BudgetCard(props) {
      const { budget, t } = props
      const ratio = Number.isFinite(budget.usedRatio) ? budget.usedRatio : 0
      const over = ratio >= 1
      const tone = over
        ? 'var(--dsw-alias-state-error-primary)'
        : ratio >= 0.8
          ? 'var(--dsw-alias-state-warn-primary)'
          : 'var(--dsw-alias-brand-primary)'
      return h(
        'div',
        { className: 'ui-card' },
        h(
          'div',
          { className: 'ui-card-head' },
          h('h3', { className: 'ui-card-title' }, t('budgetLeft')),
          h('span', { className: 'ui-muted' }, t('budgetOf') + ' ' + fmtUsd(budget.budgetUsd)),
        ),
        h('div', { className: 'ui-progress', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': Math.round(ratio * 100) },
          h('div', { className: 'ui-progress-fill', style: { width: Math.min(100, ratio * 100) + '%', background: tone } }),
        ),
        h(
          'div',
          { className: 'ui-budget-line' },
          h('span', null, t('used') + ' ' + fmtUsd(budget.spentUsd) + ' · ' + fmtPercent(ratio * 100)),
          h('span', { style: { color: over ? tone : undefined } }, over ? t('overBudget') : t('budgetLeft') + ' ' + fmtUsd(budget.remainingUsd)),
        ),
        h(
          'div',
          { className: 'ui-budget-grid' },
          h('div', { className: 'ui-budget-cell' }, h('span', { className: 'ui-muted' }, t('today')), h('b', null, fmtUsd(budget.todayUsd))),
          h('div', { className: 'ui-budget-cell' }, h('span', { className: 'ui-muted' }, t('avgPerDay')), h('b', null, fmtUsd(budget.avgDayUsd))),
          h('div', { className: 'ui-budget-cell' }, h('span', { className: 'ui-muted' }, t('projected')), h('b', null, fmtUsd(budget.projected30Usd))),
          h(
            'div',
            { className: 'ui-budget-cell' },
            h('span', { className: 'ui-muted' }, t('daysLeft')),
            h('b', null, budget.daysRemaining == null ? '—' : String(budget.daysRemaining) + ' ' + t('days')),
          ),
        ),
      )
    }

    function TimelineCard(props) {
      const { data, t } = props
      const allDays = Array.isArray(data.timeline) ? data.timeline : []
      const ranges = [7, 14, 30].filter((value) => value <= Math.max(7, allDays.length))
      const [range, setRange] = useState(ranges.indexOf(14) !== -1 ? 14 : 7)
      const [metric, setMetric] = useState('tokens')
      const days = allDays.slice(-Math.min(range, allDays.length))
      const dayValue = (day) => {
        if (metric === 'cost') return Number(day.costUsd) || 0
        if (metric === 'output') return Number(day.outputTokens) || 0
        return Number(day.totalTokens) || 0
      }
      const seriesFor = (day) => {
        if (metric === 'tokens') {
          return [
            { key: 'output', value: Number(day.outputTokens) || 0 },
            { key: 'input', value: Number(day.inputTokens) || 0 },
            { key: 'cache', value: Number(day.cacheReadTokens) || 0 },
          ]
        }
        return [{ key: metric === 'cost' ? 'cost' : 'output', value: Math.max(0, dayValue(day)) }]
      }
      const max = Math.max(0, ...days.map(dayValue))
      const { top, ticks } = axisScale(max, metric)
      const todayKey = localDayKey(Date.now())
      const plotRef = useRef(null)
      const [plotWidth, setPlotWidth] = useState(0)
      const hasChart = max > 0
      useEffect(() => {
        const node = plotRef.current
        if (!node || typeof ResizeObserver === 'undefined') return undefined
        const observer = new ResizeObserver((entries) => {
          if (entries.length) setPlotWidth(entries[0].contentRect.width)
        })
        observer.observe(node)
        return () => observer.disconnect()
      }, [hasChart])
      const maxLabels = plotWidth > 0 ? Math.max(2, Math.floor(plotWidth / 52)) : 8
      const labelStep = Math.max(1, Math.ceil(days.length / maxLabels))
      const pitch = days.length > 0 && plotWidth > 0 ? plotWidth / days.length : 0
      const labelIndexes = new Set()
      for (let index = 0; index < days.length; index += labelStep) labelIndexes.add(index)
      if (days.length > 0) {
        const lastIndex = days.length - 1
        const previous = lastIndex - (lastIndex % labelStep)
        if (previous !== lastIndex && (lastIndex - previous) * pitch < 34) labelIndexes.delete(previous)
        labelIndexes.add(lastIndex)
      }
      const sums = days.reduce(
        (acc, day) => {
          acc.input += Number(day.inputTokens) || 0
          acc.cacheRead += Number(day.cacheReadTokens) || 0
          acc.output += Number(day.outputTokens) || 0
          acc.cost += Number(day.costUsd) || 0
          return acc
        },
        { input: 0, cacheRead: 0, output: 0, cost: 0 },
      )
      const tipRow = (label, value, dot) =>
        h(
          'div',
          { className: 'ui-tip-row', key: label },
          dot ? h('span', { className: 'ui-dot ' + dot }) : h('span', { className: 'ui-tip-spacer' }),
          h('span', null, label),
          h('b', null, value),
        )
      return h(
        'div',
        { className: 'ui-card' },
        h(
          'div',
          { className: 'ui-card-head' },
          h('h3', { className: 'ui-card-title' }, t('timeline')),
          h(
            'div',
            { style: { display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' } },
            h(
              'div',
              { className: 'ui-seg', role: 'group', 'aria-label': t('range') },
              ranges.map((value) =>
                h(
                  'button',
                  {
                    key: value,
                    type: 'button',
                    className: range === value ? 'is-active' : undefined,
                    onClick: () => setRange(value),
                  },
                  String(value) + 'd',
                ),
              ),
            ),
            h(
              'div',
              { className: 'ui-seg', role: 'group' },
              [
                ['tokens', t('tokens')],
                ['output', t('outputOnly')],
                ['cost', t('cost')],
              ].map(([key, label]) =>
                h(
                  'button',
                  {
                    key,
                    type: 'button',
                    className: metric === key ? 'is-active' : undefined,
                    onClick: () => setMetric(key),
                  },
                  label,
                ),
              ),
            ),
          ),
        ),
        max <= 0 || top <= 0
          ? h('div', { className: 'ui-empty' }, t('noUsage'))
          : h(
              'div',
              { className: 'ui-chart' },
              h(
                'div',
                { className: 'ui-axis', 'aria-hidden': 'true' },
                ticks.map((tick, index) =>
                  h(
                    'span',
                    {
                      key: index,
                      className: 'ui-axis-label' + (tick === 0 ? ' is-zero' : ''),
                      style: { bottom: (tick / top) * 100 + '%' },
                    },
                    fmtAxisValue(tick, metric),
                  ),
                ),
              ),
              h(
                'div',
                { className: 'ui-plot', ref: plotRef },
                h(
                  'div',
                  { className: 'ui-grid', 'aria-hidden': 'true' },
                  ticks.map((tick, index) =>
                    index === 0 ? null : h('div', { key: index, className: 'ui-grid-line', style: { bottom: (tick / top) * 100 + '%' } }),
                  ),
                ),
                h(
                  'div',
                  { className: 'ui-bars', role: 'img', 'aria-label': t('timeline') },
                  days.map((day) => {
                    const series = seriesFor(day)
                    const total = series.reduce((sum, item) => sum + item.value, 0)
                    const barPct = top > 0 ? Math.min(100, (total / top) * 100) : 0
                    const cap = series.find((item) => item.value > 0)
                    const isToday = day.date === todayKey
                    return h(
                      'div',
                      {
                        key: day.date,
                        className: 'ui-bar-col' + (isToday ? ' is-today' : ''),
                        style: { '--bar': barPct + '%' },
                      },
                      h(
                        'div',
                        { className: 'ui-bar-track' },
                        series.map((item) =>
                          h('div', {
                            key: item.key,
                            className: 'ui-bar-seg ' + item.key + (cap && item.key === cap.key ? ' is-cap' : ''),
                            style: {
                              height: item.value > 0 ? (item.value / top) * 100 + '%' : 0,
                              minHeight: item.value > 0 ? '2px' : 0,
                            },
                          }),
                        ),
                      ),
                      h(
                        'div',
                        { className: 'ui-tip' },
                        h('div', { className: 'ui-tip-head' }, monthDay(day.date) + (isToday ? ' · ' + t('today') : '')),
                        tipRow(t('totalTokens'), fmtTokens(day.totalTokens)),
                        tipRow(t('cache'), fmtTokens(day.cacheReadTokens), 'cache'),
                        tipRow(t('input'), fmtTokens(day.inputTokens), 'input'),
                        tipRow(t('output'), fmtTokens(day.outputTokens), 'output'),
                        tipRow(t('cost'), fmtUsd(day.costUsd)),
                      ),
                    )
                  }),
                ),
              ),
              h(
                'div',
                { className: 'ui-dates', 'aria-hidden': 'true' },
                days.map((day, index) =>
                  h(
                    'span',
                    { key: day.date, className: 'ui-date' + (day.date === todayKey ? ' is-today' : '') },
                    labelIndexes.has(index) ? monthDay(day.date) : '',
                  ),
                ),
              ),
            ),
        h(
          'div',
          { className: 'ui-legend' },
          metric === 'tokens'
            ? [
                h('span', { key: 'cache' }, h('span', { className: 'ui-dot cache' }), t('cache') + ' ' + fmtTokens(sums.cacheRead)),
                h('span', { key: 'input' }, h('span', { className: 'ui-dot input' }), t('input') + ' ' + fmtTokens(sums.input)),
                h('span', { key: 'output' }, h('span', { className: 'ui-dot output' }), t('output') + ' ' + fmtTokens(sums.output)),
              ]
            : metric === 'cost'
              ? h('span', null, h('span', { className: 'ui-dot cost' }), t('cost') + ' ' + fmtUsd(sums.cost))
              : h('span', null, h('span', { className: 'ui-dot output' }), t('output') + ' ' + fmtTokens(sums.output)),
        ),
      )
    }

    function SessionsCard(props) {
      const { data, t, formats } = props
      const [query, setQuery] = useState('')
      const [sortKey, setSortKey] = useState('costUsd')
      const [sortDir, setSortDir] = useState(-1)
      const [expanded, setExpanded] = useState(null)
      const [page, setPage] = useState(1)
      const sessions = Array.isArray(data.sessions) ? data.sessions : []
      const rows = useMemo(() => {
        const needle = query.trim().toLowerCase()
        let filtered = sessions
        if (needle) {
          filtered = sessions.filter((session) => {
            const haystack = [session.title, session.cwd, session.id].join(' ').toLowerCase()
            return haystack.indexOf(needle) !== -1
          })
        }
        const valueOf = (session) =>
          sortKey === 'tokens' ? Number(session.tokens && session.tokens.totalTokens) || 0 : Number(session[sortKey]) || 0
        return filtered.slice().sort((a, b) => (valueOf(a) - valueOf(b)) * sortDir)
      }, [sessions, query, sortKey, sortDir])

      const totalPages = Math.max(1, Math.ceil(rows.length / SESSIONS_PER_PAGE))
      const currentPage = Math.min(Math.max(1, page), totalPages)
      const pageStart = (currentPage - 1) * SESSIONS_PER_PAGE
      const pageRows = rows.slice(pageStart, pageStart + SESSIONS_PER_PAGE)
      const goToPage = (value) => {
        setPage(Math.min(Math.max(1, value), totalPages))
        setExpanded(null)
      }
      const toggleSort = (key) => {
        setPage(1)
        setExpanded(null)
        if (sortKey === key) setSortDir((value) => -value)
        else {
          setSortKey(key)
          setSortDir(-1)
        }
      }
      const sortMark = (key) => (sortKey === key ? (sortDir < 0 ? ' ↓' : ' ↑') : '')

      return h(
        'div',
        { className: 'ui-card' },
        h(
          'div',
          { className: 'ui-card-head' },
          h('h3', { className: 'ui-card-title' }, t('sessionsTitle')),
          h('span', { className: 'ui-muted' }, rows.length + ' / ' + sessions.length),
        ),
        h('input', {
          className: 'ui-search',
          type: 'search',
          value: query,
          placeholder: t('search'),
          'aria-label': t('search'),
          onChange: (event) => {
            setQuery(event.target.value)
            setPage(1)
            setExpanded(null)
          },
          style: { marginBottom: '10px' },
        }),
        rows.length === 0
          ? h('div', { className: 'ui-empty' }, t('noSessions'))
          : h(
              'div',
              { className: 'ui-table-wrap' },
              h(
                'table',
                { className: 'ui-table' },
                h(
                  'colgroup',
                  null,
                  h('col', null),
                  h('col', { style: { width: '128px' } }),
                  h('col', { style: { width: '100px' } }),
                  h('col', { style: { width: '92px' } }),
                  h('col', { style: { width: '150px' } }),
                ),
                h(
                  'thead',
                  null,
                  h(
                    'tr',
                    null,
                    h('th', null, t('session')),
                    h('th', null, t('model')),
                    h(
                      'th',
                      { className: 'ui-sortable ui-num', onClick: () => toggleSort('tokens') },
                      t('totalTokens') + sortMark('tokens'),
                    ),
                    h(
                      'th',
                      { className: 'ui-sortable ui-num', onClick: () => toggleSort('costUsd') },
                      t('cost') + sortMark('costUsd'),
                    ),
                    h(
                      'th',
                      { className: 'ui-sortable', onClick: () => toggleSort('lastActivityAt') },
                      t('lastActive') + sortMark('lastActivityAt'),
                    ),
                  ),
                ),
                h(
                  'tbody',
                  null,
                  pageRows.map((session) => {
                    const isOpen = expanded === session.id
                    const modelLabel =
                      session.models && session.models.length
                        ? session.models[0].model + (session.models.length > 1 ? ' +' + (session.models.length - 1) : '')
                        : '—'
                    const row = h(
                      'tr',
                      {
                        key: session.id,
                        className: 'ui-row',
                        tabIndex: 0,
                        onClick: () => setExpanded(isOpen ? null : session.id),
                        onKeyDown: (event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault()
                            setExpanded(isOpen ? null : session.id)
                          }
                        },
                      },
                      h(
                        'td',
                        null,
                        h(
                          'div',
                          { className: 'ui-session-title' },
                          h('span', { className: 'ui-session-name', title: session.title }, session.title || session.id.slice(0, 10)),
                          session.origin === 'subagent' ? h('span', { className: 'ui-badge' }, t('subagent')) : null,
                          session.readError ? h('span', { className: 'ui-badge ui-badge-error' }, t('readError')) : null,
                        ),
                        h('div', { className: 'ui-muted ui-ellipsis' }, baseName(session.cwd) || session.id),
                      ),
                      h('td', { className: 'ui-muted' }, modelLabel),
                      h(
                        'td',
                        { className: 'ui-num', title: numberText(session.tokens && session.tokens.totalTokens) + ' ' + t('tokensUnit') },
                        fmtTokens(session.tokens && session.tokens.totalTokens),
                      ),
                      h('td', { className: 'ui-num' }, fmtUsd(session.costUsd)),
                      h('td', { className: 'ui-muted' }, fmtDate(formats, session.lastActivityAt, true)),
                    )
                    if (!isOpen) return row
                    const tokens = session.tokens || {}
                    const detail = h(
                      'tr',
                      { key: session.id + '-detail' },
                      h(
                        'td',
                        { colSpan: 5 },
                        h(
                          'div',
                          { className: 'ui-detail' },
                          h('div', null, h('dt', null, t('breakdown')), h('dd', null, t('input') + ' ' + numberText(tokens.inputTokens))),
                          h('div', null, h('dt', null, t('cache')), h('dd', null, numberText(tokens.cacheReadTokens))),
                          h('div', null, h('dt', null, t('cacheWrite')), h('dd', null, numberText(tokens.cacheWriteTokens))),
                          h('div', null, h('dt', null, t('output')), h('dd', null, numberText(tokens.outputTokens))),
                          h('div', null, h('dt', null, t('reasoning')), h('dd', null, numberText(tokens.reasoningTokens))),
                          h('div', null, h('dt', null, t('model')), h('dd', null, modelLabel)),
                          h('div', null, h('dt', null, t('provider')), h('dd', null, (session.models && session.models[0] && session.models[0].provider) || '—')),
                          h('div', null, h('dt', null, t('lastActive')), h('dd', null, fmtDate(formats, session.lastActivityAt, true))),
                          h('div', { className: 'ui-detail-full' }, h('dt', null, t('cwd')), h('dd', null, session.cwd || '—')),
                          h('div', { className: 'ui-detail-full' }, h('dt', null, t('sessionId')), h('dd', null, session.id)),
                          session.parentSession
                            ? h('div', { className: 'ui-detail-full' }, h('dt', null, t('parent')), h('dd', null, session.parentSession))
                            : null,
                          session.readError
                            ? h('div', { className: 'ui-detail-full' }, h('dt', null, t('readError')), h('dd', null, session.readError))
                            : null,
                        ),
                      ),
                    )
                    return h(React.Fragment, { key: session.id }, row, detail)
                  }),
                ),
              ),
            ),
        rows.length > 0 && totalPages > 1
          ? h(
              'div',
              { className: 'ui-pager' },
              h('span', { className: 'ui-pager-info' }, pageStart + 1 + '–' + (pageStart + pageRows.length) + ' / ' + rows.length),
              h(
                'div',
                { className: 'ui-pager-pages' },
                h(
                  'button',
                  {
                    type: 'button',
                    className: 'ui-btn ui-pager-step',
                    disabled: currentPage <= 1,
                    'aria-label': t('prev'),
                    title: t('prev'),
                    onClick: () => goToPage(currentPage - 1),
                  },
                  '‹',
                ),
                pageWindow(currentPage, totalPages).map((item) =>
                  typeof item === 'number'
                    ? h(
                        'button',
                        {
                          key: item,
                          type: 'button',
                          className: 'ui-btn ui-pager-page' + (item === currentPage ? ' is-current' : ''),
                          'aria-current': item === currentPage ? 'page' : undefined,
                          onClick: () => goToPage(item),
                        },
                        String(item),
                      )
                    : h('span', { key: item, className: 'ui-pager-gap' }, '…'),
                ),
                h(
                  'button',
                  {
                    type: 'button',
                    className: 'ui-btn ui-pager-step',
                    disabled: currentPage >= totalPages,
                    'aria-label': t('next'),
                    title: t('next'),
                    onClick: () => goToPage(currentPage + 1),
                  },
                  '›',
                ),
              ),
            )
          : null,
      )
    }

    function Sparkline(props) {
      const history = props.history || []
      if (history.length < 2) {
        return h('div', { className: 'ui-empty', style: { padding: '14px 0' } }, '—')
      }
      const width = 240
      const height = 64
      const max = Math.max(20, ...history.map((point) => Math.max(point.proc, point.sys)))
      const pointsFor = (key) =>
        history
          .map((point, index) => {
            const x = (index / (history.length - 1)) * width
            const y = height - Math.min(height, ((Number(point[key]) || 0) / max) * height)
            return x.toFixed(1) + ',' + y.toFixed(1)
          })
          .join(' ')
      return h(
        'svg',
        {
          className: 'ui-spark',
          viewBox: '0 0 ' + width + ' ' + height,
          preserveAspectRatio: 'none',
          role: 'img',
          'aria-label': props.label,
        },
        h('line', { x1: 0, y1: height / 2, x2: width, y2: height / 2, stroke: 'var(--dsw-alias-border-l1)', strokeWidth: 1, strokeDasharray: '3 3' }),
        h('polyline', {
          points: pointsFor('sys'),
          fill: 'none',
          stroke: 'var(--dsw-alias-label-secondary)',
          strokeWidth: 1.2,
          opacity: 0.55,
          vectorEffect: 'non-scaling-stroke',
        }),
        h('polyline', {
          points: pointsFor('proc'),
          fill: 'none',
          stroke: 'var(--dsw-alias-brand-primary)',
          strokeWidth: 1.6,
          vectorEffect: 'non-scaling-stroke',
        }),
      )
    }

    function CpuCard(props) {
      const { data, t, history } = props
      const cpu = data && data.cpu ? data.cpu : null
      if (!cpu || !cpu.process || !cpu.system) {
        return h('div', { className: 'ui-card' }, h('h3', { className: 'ui-card-title' }, t('cpuTitle')), h('div', { className: 'ui-empty' }, t('noUsage')))
      }
      const process = cpu.process
      const system = cpu.system
      const cores = Array.isArray(system.perCore) ? system.perCore : []
      return h(
        'div',
        { className: 'ui-card' },
        h(
          'div',
          { className: 'ui-card-head' },
          h('h3', { className: 'ui-card-title' }, t('cpuTitle')),
          h('span', { className: 'ui-muted' }, t('pid') + ' ' + process.pid + ' · ' + t('cpuHint')),
        ),
        h(
          'div',
          { className: 'ui-cpu-grid' },
          h(
            'div',
            { className: 'ui-cpu-cell' },
            h('span', { className: 'ui-muted' }, t('processCpu')),
            h('b', null, fmtPercent(process.percentOfCore)),
            h('div', { className: 'ui-muted', style: { fontSize: '10px' } }, t('ofOneCore') + ' · ' + t('machine') + ' ' + fmtPercent(process.percentOfMachine)),
          ),
          h(
            'div',
            { className: 'ui-cpu-cell' },
            h('span', { className: 'ui-muted' }, t('systemCpu')),
            h('b', null, fmtPercent(system.percent)),
            h('div', { className: 'ui-muted', style: { fontSize: '10px' } }, system.cpuCount + ' ' + t('cores')),
          ),
          h(
            'div',
            { className: 'ui-cpu-cell' },
            h('span', { className: 'ui-muted' }, t('load')),
            h('b', null, [system.load1, system.load5, system.load15].map((v) => (Number(v) || 0).toFixed(2)).join(' / ')),
            h('div', { className: 'ui-muted', style: { fontSize: '10px' } }, t('uptime') + ' ' + fmtDuration(system.uptimeSeconds)),
          ),
          h(
            'div',
            { className: 'ui-cpu-cell' },
            h('span', { className: 'ui-muted' }, t('memory')),
            h('b', null, fmtPercent(system.usedMemRatio * 100)),
            h('div', { className: 'ui-muted', style: { fontSize: '10px' } }, 'RSS ' + fmtBytes(process.rssBytes) + ' · ' + fmtBytes(system.freeMemBytes) + ' free'),
          ),
        ),
        h(Sparkline, { history, label: t('cpuTitle') }),
        h(
          'div',
          { className: 'ui-cores-head' },
          h('span', null, t('cores')),
          h('span', null, t('recent') + ' · ' + history.length),
        ),
        h(
          'div',
          { className: 'ui-cores' },
          cores.map((core) =>
            h(
              'div',
              { className: 'ui-core', key: core.index, title: t('core') + ' ' + (core.index + 1) + ' · ' + fmtPercent(core.percent) },
              h('div', { className: 'ui-core-track' }, h('div', { className: 'ui-core-fill', style: { height: Math.max(0, Math.min(100, core.percent)) + '%' } })),
              h('span', null, core.index + 1),
            ),
          ),
        ),
      )
    }

    function PricingCard(props) {
      const { data, t } = props
      const pricing = data.pricing || { models: {}, default: {} }
      const models = Object.keys(pricing.models || {})
      const priceRows = models.map((model) =>
        h(
          'tr',
          { key: model },
          h('td', null, model),
          h('td', null, fmtPrice(pricing.models[model].input)),
          h('td', null, fmtPrice(pricing.models[model].cachedInput)),
          h('td', null, fmtPrice(pricing.models[model].output)),
        ),
      )
      priceRows.push(
        h(
          'tr',
          { key: '__default' },
          h('td', null, t('priceDefault')),
          h('td', null, fmtPrice(pricing.default && pricing.default.input)),
          h('td', null, fmtPrice(pricing.default && pricing.default.cachedInput)),
          h('td', null, fmtPrice(pricing.default && pricing.default.output)),
        ),
      )
      return h(
        'details',
        { className: 'ui-card ui-details' },
        h('summary', null, t('pricing')),
        h(
          'div',
          { className: 'ui-details-body' },
          h(
            'table',
            { className: 'ui-price-table' },
            h(
              'thead',
              null,
              h('tr', null, h('th', null, t('model')), h('th', null, t('priceInput')), h('th', null, t('priceCache')), h('th', null, t('priceOutput'))),
            ),
            h('tbody', null, priceRows),
          ),
          data.unknownModels && data.unknownModels.length
            ? h('p', { className: 'ui-footnote', style: { marginTop: '8px' } }, t('unknownModels') + ' ' + data.unknownModels.join(', '))
            : null,
          h('p', { className: 'ui-footnote', style: { marginTop: '8px' } }, t('changeHint')),
        ),
      )
    }

    function UsageInsightsPage(props) {
      const { locale } = props
      useLocaleRevision(locale)
      const chinese = localeIsChinese(locale)
      const dict = chinese ? TEXT.zh : TEXT.en
      const t = (key) => (dict && dict[key] != null ? dict[key] : TEXT.en[key] != null ? TEXT.en[key] : key)
      const formats = useDateFormats(chinese)
      const { state, refresh } = useSnapshot()
      const [cpuHistory, setCpuHistory] = useState([])
      const generatedAt = state.data && state.data.generatedAt

      useEffect(() => {
        const cpu = state.data && state.data.cpu
        if (!cpu || !cpu.process) return
        setCpuHistory((previous) => {
          if (previous.length && previous[previous.length - 1].at === cpu.sampledAt) return previous
          return previous
            .concat([{ at: cpu.sampledAt, proc: cpu.process.percentOfCore, sys: cpu.system.percent }])
            .slice(-48)
        })
      }, [generatedAt])

      const head = h(
        'div',
        { className: 'ui-head' },
        h(
          'div',
          null,
          h('h1', { className: 'ui-title' }, t('title')),
          h('p', { className: 'ui-sub' }, t('subtitle')),
        ),
        h(
          'div',
          { className: 'ui-head-actions' },
          state.updatedAt
            ? h('span', null, t('updated') + ' ' + formats.time.format(new Date(state.updatedAt)))
            : null,
          h('button', { type: 'button', className: 'ui-btn', onClick: refresh }, t('refresh')),
        ),
      )

      if (!state.data) {
        return h(
          'div',
          { className: 'ui-root' },
          h('style', null, CSS),
          head,
          state.error
            ? h(
                'div',
                { className: 'ui-card' },
                h('div', { className: 'ui-error-banner' }, h('span', null, t('errorTitle') + ' · ' + state.error), h('button', { type: 'button', className: 'ui-btn', onClick: refresh }, t('retry'))),
              )
            : h('div', { className: 'ui-loading' }, t('loading')),
        )
      }

      const data = state.data
      const totals = data.totals || {}
      const budget = data.budget || { budgetUsd: 0, spentUsd: 0, remainingUsd: 0, usedRatio: 0, todayUsd: 0, avgDayUsd: 0, projected30Usd: 0, daysRemaining: null }
      const errors = Array.isArray(data.errors) ? data.errors : []
      const over = (budget.usedRatio || 0) >= 1

      return h(
        'div',
        { className: 'ui-root' },
        h('style', null, CSS),
        head,
        state.error
          ? h('div', { className: 'ui-error-banner' }, h('span', null, t('errorTitle') + ' · ' + state.error), h('button', { type: 'button', className: 'ui-btn', onClick: refresh }, t('retry')))
          : null,
        errors.length
          ? h('div', { className: 'ui-warn-banner' }, errors.length + ' ' + t('errors'))
          : null,
        h(
          'section',
          { className: 'ui-kpis' },
          h(Kpi, {
            label: t('totalTokens'),
            value: fmtTokens(totals.totalTokens),
            exact: numberText(totals.totalTokens),
            sub: t('input') + ' ' + fmtTokens(totals.inputTokens) + ' · ' + t('cache') + ' ' + fmtTokens(totals.cacheReadTokens) + ' · ' + t('output') + ' ' + fmtTokens(totals.outputTokens),
          }),
          h(Kpi, {
            label: t('sessions'),
            value: String(totals.sessions || 0),
            sub: t('subagent') + ' ' + (totals.subagentSessions || 0),
          }),
          h(Kpi, {
            label: t('estCost'),
            value: fmtUsd(totals.costUsd),
            exact: '$' + Number(totals.costUsd || 0).toFixed(4),
            sub: t('avgPerDay') + ' ' + fmtUsd(budget.avgDayUsd) + ' ' + t('perDay'),
          }),
          h(Kpi, {
            label: t('budgetLeft'),
            value: fmtUsd(budget.remainingUsd),
            exact: fmtPercent((budget.usedRatio || 0) * 100) + ' ' + t('used'),
            sub: t('budgetOf') + ' ' + fmtUsd(budget.budgetUsd) + (over ? ' · ' + t('overBudget') : ''),
            tone: over ? 'var(--dsw-alias-state-error-primary)' : undefined,
          }),
        ),
        h(BudgetCard, { budget, t }),
        h(TimelineCard, { data, t }),
        h(SessionsCard, { data, t, formats }),
        h(CpuCard, { data, t, history: cpuHistory }),
        h(PricingCard, { data, t }),
        h('p', { className: 'ui-footnote' }, t('footnote')),
      )
    }

    function PanelIcon(props) {
      const size = Number(props.size) > 0 ? Number(props.size) : 18
      return h(
        'svg',
        {
          viewBox: '0 0 24 24',
          width: size,
          height: size,
          focusable: 'false',
          'aria-hidden': 'true',
          style: { display: 'block', opacity: props.active ? 1 : 0.72 },
        },
        h('path', { d: 'M4 20v-7', stroke: 'currentColor', strokeWidth: 2.2, strokeLinecap: 'round' }),
        h('path', { d: 'M10 20V9', stroke: 'currentColor', strokeWidth: 2.2, strokeLinecap: 'round' }),
        h('path', { d: 'M16 20V4', stroke: 'currentColor', strokeWidth: 2.2, strokeLinecap: 'round' }),
        h('path', { d: 'M3 21h18', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', opacity: 0.6 }),
      )
    }

    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        ctx.effect(() => ctx.locale.register(NS, 'zh', TEXT.zh), 'usage-insights: zh dictionary')
        ctx.effect(() => ctx.locale.register(NS, 'en', TEXT.en), 'usage-insights: en dictionary')
        const t = ctx.locale.bind(NS)
        ctx.slots.inject('sidebar.panellist', () =>
          ctx.slots.register(
            {
              name: 'sidebar.panellist',
              id: 'usage-insights',
              order: 5,
              label: () => t('nav'),
            },
            PanelIcon,
          ),
        )
        ctx.slots.inject('main', () =>
          ctx.slots.register(
            { name: 'main', key: 'usage-insights' },
            (props) => h(UsageInsightsPage, { ...props, locale: ctx.locale }),
          ),
        )
      },
    }
  },
})
