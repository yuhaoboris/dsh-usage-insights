# dsh-usage-insights

A [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) Web UI plugin that adds a
**用量统计 / Usage Stats** entry to the left sidebar and opens a full statistics panel built from
the profile's real, durable session logs.

There is no synthetic data and no separate ledger: totals, per-session figures, and the timeline are
all folded from committed `assistant/message` usage records.

## What it shows

| Area | Content |
|---|---|
| KPI row | Total tokens, session count (live / sub-agent split), estimated cost, budget remaining |
| Budget | Spent vs. budget, progress bar, today, 7-day daily average, 30-day projection, days remaining |
| Timeline | Daily bars over 7 / 14 / 30 days; stacked cache-read / input / output tokens, output-only tokens, or cost |
| Sessions | Sortable, searchable table of every session: model, token total, estimated cost, last activity; expanding a row reveals the token breakdown, models, working directory, session ID, and parent session |
| CPU | Process CPU (per-core and machine share), system CPU, load 1/5/15, memory, uptime, per-core bars, and a rolling sparkline of recent samples |
| Rates | Collapsible table of the estimated USD-per-1M-token rates used for the cost figure |

The sidebar icon is registered at order 5, between **Plugins** and **Schedules**.

## Requirements

- A Harness profile composed with the Web GUI (`@deepseek-ai/dsh-web-app` or equivalent), providing
  `ctx.sessionQuery` and `ctx.webServer`.
- A Node/Host runtime with `node:os` (all standard DSH desktop/web deployments).

Developed and verified against DSH `0.2.1-rc.5`.

## Install

Install this directory as a bundle into a profile. In the Harness Web UI, use **Plugins → Add** and
select this folder; the profile's bundle selection and `dsh.profile.bundles` are updated for you.
Programmatic callers can use the `plugin_manager` action `install_bundle` with this directory as the
absolute `target`.

The bundle inserts this row through its `cordis.patch.yml`:

```yaml
- insert:
    - id: usage-insights
      name: dsh-usage-insights
      config:
        budgetUsd: 20
        timelineDays: 30
        includeSubagents: true
```

Once active, open **用量统计** in the left sidebar. No page reload is needed on a profile with HMR;
otherwise restart the profile after installation.

## Data source

- `ctx.sessionQuery.listSessions()` enumerates the whole logical corpus (all workspaces, live and
  persisted sessions, including sub-agents).
- `ctx.sessionQuery.readSession(id)` replays each log; the Host folds only committed
  `assistant/message` events carrying provider `usage`. Events copied into a fork
  (`inheritedEventCount`) are skipped so parent usage is not counted twice.
- Session titles come from the latest `session/title` event, falling back to the first user message.
- CPU/memory come from `node:os` and `process` inside the Host process, sampled every 2 seconds.

The Host caches per-session folds: live sessions refresh at most every 10 s and the whole corpus
every 5 min, so a 5-second browser poll never replays every log.

## Cost model

```text
cost = input × inputRate
     + cacheRead × cachedInputRate
     + cacheWrite × cacheWriteRate
     + output × outputRate
```

Rates are **USD per 1,000,000 tokens**. Reasoning tokens are a subset of output and are not charged
twice. These are estimates at configured rates, not billing records. Defaults are DeepSeek-style
estimates and should be adjusted to the rates on your account.

## Configuration

Edit the `usage-insights` row in the profile's `cordis.patch.yml`, or the `config` block in this
bundle's `cordis.patch.yml` before installing:

```yaml
- id: usage-insights
  config:
    budgetUsd: 20
    timelineDays: 30
    refreshMs: 5000
    liveRefreshMs: 10000
    fullRefreshMs: 300000
    includeSubagents: true
    pricing:
      deepseek-flash:
        input: 0.28
        cachedInput: 0.028
        cacheWrite: 0.28
        output: 0.42
    defaultPrice:
      input: 0.28
      cachedInput: 0.028
      cacheWrite: 0.28
      output: 0.42
```

| Field | Default | Meaning |
|---|---|---|
| `budgetUsd` | `20` | Budget ceiling for spent/remaining figures; `0` disables the ceiling display |
| `timelineDays` | `30` | Days of daily buckets the Host returns (7–90) |
| `refreshMs` | `5000` | Browser poll interval (minimum 2000) |
| `liveRefreshMs` | `10000` | Minimum re-read interval for a live session |
| `fullRefreshMs` | `300000` | Full corpus re-read interval |
| `includeSubagents` | `true` | Count sub-agent sessions in totals and the table |
| `pricing` | DeepSeek estimates | Per-model rates in USD per 1M tokens |
| `defaultPrice` | same as above | Fallback rate for models not listed |

Budget figures compare the **all-time estimated cost** against `budgetUsd`; the 30-day projection
uses the last seven days' average daily cost.

## Transport and privacy

The Host registers one read-only exact route, `GET /usage-insights/snapshot`, on the existing
`webServer`. It returns aggregates, session titles, working directories, session IDs, and
CPU/memory counters — never message content. The route is unauthenticated like every other named
route on that carrier, so it inherits the server's loopback bind. Responses are `no-store`.

## Repository layout

| File | Role |
|---|---|
| `index.js` | Host half: corpus fold, cost/budget, CPU sampler, snapshot route |
| `client.js` | Client half: sidebar panel icon + main panel React view (plain JS, no JSX) |
| `cordis.patch.yml` | Bundle patch that inserts the `usage-insights` row |
| `locale/en.json`, `locale/zh.json` | Plugin Manager display metadata |
| `icon.svg` | Original icon (bars) |
| `package.json` | Bundle manifest: `dsh.bundle.patch`, `dsh.client`, exports |

## Development notes

- The Host half is plain ESM: `export function apply(ctx, config)` plus `inject`.
- The Client half is a plain-JavaScript `window.__ModuleLoader__` factory: no build step, no JSX, and
  only `react` from the shared module table.
- The plugin owns no dependencies; installing it links this directory into the profile.
- `client.js` talks to `index.js` through the Host route described above rather than a generated
  Remote namespace, so the bundle stays dependency-free.

## License

Released under the [MIT License](LICENSE).

Copyright (c) 2026 Boris Yu.

The plugin has no runtime dependencies, so there are no third-party license
obligations to combine with this one.
