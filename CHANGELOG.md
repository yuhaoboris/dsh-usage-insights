# Changelog

Notable changes per release, newest first. `script/release.mjs` promotes the `Unreleased` section
into a dated version heading and uses it as the GitHub release body, so write these for people using
the plugin rather than as a git log.

## Unreleased

### Fixed

- The timeline no longer draws an empty outlined box around the most recent day. That frame was the
  full-height bar track, not the bar itself; today is now marked on its date label instead.
- Daily bars sit on a labelled value axis with gridlines, so magnitudes are readable at a glance and
  zero-usage days no longer look like rendering gaps.
- The output-only view uses the same green as its legend entry (the bars were black before).
- A day with a small but non-zero total keeps a 2px stub instead of vanishing.
- The range selector stays in sync when the Host returns fewer days than the 14-day default.
- The panel scrolls inside the host's fixed-height main area instead of being clipped at the fold,
  so the CPU, rates and footer sections are reachable again.
- The session table paginates at 10 rows per page with a range readout and page buttons instead of
  stopping at 12 behind a show-all button. Column widths stay fixed across pages, and the header
  stays pinned while the list scrolls.

### Added

- Hovering a day in the timeline shows its cache-read, input, output, total and cost figures.

### Changed

- Sessions no longer carry a "live" badge, and the session KPI no longer splits out live sessions.

## v1.0.0 — 2026-11-03

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
