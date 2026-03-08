# UX.md

````markdown
# UX - PHPSage

User experience contract for current implementation.

## Current UX State

The web app is implemented with three main views:

- `Dashboard`
- `Insights`
- `Issue`

Navigation and state are URL-synced where relevant.

## Dashboard

Implemented behavior:

- Run list with selection and active run highlighting
- Run start from UI by target path (`POST /api/runs/start` with `execute=true`)
- Run start target helpers:
  - presets
  - enter-to-run
  - reset target
  - prefill from selected run
- Run detail panel with:
  - status/timestamps
  - logs
  - issues
  - source preview
  - files navigator
- Local filters for logs/issues and persisted UI controls
- Live polling while selected run is `running`
- Auto-run controls with interval and resilience settings
- AI status indicator (`ON/OFF`, provider/model)
- Recent ingest jobs panel (status, filters, detail expansion)

## Insights

Implemented behavior:

- Identifier summary from selected run
- KPI cards:
  - total issues
  - unique identifiers
  - top identifier
  - known coverage
- Visual charts:
  - horizontal distribution bars per identifier
  - donut chart for top 5 share
- Identifier list with PHPStan docs links when identifier is known

## Issue View

Implemented behavior:

- Active issue context
- File/code navigation with highlighted issue lines
- AI Assist panel bound to active issue:
  - explain output
  - suggest-fix output
  - readable diff rendering
  - fallback messaging when no safe patch is available

## Side Panel UX

Implemented behavior:

- `Project Files` header with styled project chip
- `Runs` section with simplified run cards (no issue-count pill)
- `Files` section tree + issue badges per file
- Header alignment for `Project Files`, `Runs`, and `Files`

## AI Debug UX

When backend debug is enabled (`AI_DEBUG_LLM_IO=true`) and payload is available:

- `Debug LLM I/O` toggle appears in AI Assist
- Debug panel shows:
  - strategy
  - endpoint
  - system prompt
  - user prompt
  - request body
- Raw provider response block is intentionally hidden in UI

## UX Principles in Current Build

- Fast operational feedback for active runs
- Clear state visibility (running/finished, errors, AI status)
- Minimal friction to re-run analyses
- Safe-by-default AI patch behavior
````