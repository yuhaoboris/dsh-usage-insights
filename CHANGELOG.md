# Changelog

Notable changes per release, newest first. `script/release.mjs` promotes the `Unreleased` section
into a dated version heading and uses it as the GitHub release body, so write these for people using
the plugin rather than as a git log.

## Unreleased

### Added

- A **用量统计 / Usage Stats** sidebar entry that opens a statistics panel built from the profile's
  real, durable session logs — no synthetic data and no separate ledger.
- KPI row with total tokens, live and sub-agent session counts, estimated cost and budget remaining.
- Budget view: spent against the ceiling, progress bar, today, 7-day daily average, 30-day
  projection and days remaining.
- Timeline with daily bars over 7, 14 or 30 days, switchable between stacked token kinds,
  output-only tokens and cost.
- Sortable, searchable session table with a per-session token breakdown, models, working directory,
  session ID and parent session.
- CPU view sampled from the Host process every 2 seconds: per-core bars, machine share, load
  averages, memory, uptime and a rolling sparkline.
- Rates table exposing the USD-per-1M-token estimates behind the cost figure.
- Configuration for budget, timeline length, refresh intervals, sub-agent inclusion and per-model
  pricing.
