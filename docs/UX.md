# UX — PHPSage

User experience guide for PHPSage.

## Current status

A minimal Dashboard is implemented with:

- runs table backed by `GET /api/runs`
- default run selection prefers an active `running` run when available
- runs table supports status filter (`all`, `running`, `finished`) persisted in URL query-state
- runs table supports sort by updated timestamp (newest/oldest)
- selected runs sort is persisted in URL query-state (`sort`)
- dashboard includes counters for all/running/finished runs
- header includes `Jump to running` quick action
- selectable run detail panel backed by `GET /api/runs/:runId`
- files navigator in detail backed by `GET /api/runs/:runId/files`
- files navigator includes search filter by path persisted in URL query-state
- files panel includes explicit action to return from manual file override to selected issue context
- paginated issues and logs sections in run detail
- issue rows display PHPStan identifier when available
- source preview for selected issue backed by `GET /api/runs/:runId/source`
- source preview shows line numbers and highlights active issue line when applicable
- URL query-state for selected run, file, issue, and logs page (`?runId=...&file=...&issue=...&logPage=...`) with reload restore (including pagination context)
- browser back/forward navigation restores the same URL state (`popstate` handling)
- issue/log navigation keeps local context synchronized without re-fetching run detail when run does not change
- selected run auto-refreshes every 2s while status is `running` (list + detail polling)
- files navigator also auto-refreshes in that 2s cycle while selected run is `running`
- run detail shows a `Live updating` badge while polling is active
- header includes live polling on/off toggle
- live polling toggle is persisted in URL query-state (`live=0` when disabled)
- header includes live polling interval selector (`2s`, `5s`, `10s`)
- selected polling interval is persisted in URL query-state (`interval`)
- header includes `Copy link` action for sharing current dashboard URL state
- manual refresh action
- UI can start a run by target path (`POST /api/runs/start` with `execute=true`)
- run starter target path is persisted in URL query-state (`target`)
- if URL has no target, run starter restores last used target from localStorage
- run starter can prefill target from currently selected run
- run starter includes quick target presets for sample projects
- pressing `Enter` on target input starts a run
- start action is disabled when target path is empty
- starter error feedback clears automatically on target changes
- run starter includes `Reset target` quick action to default sample path
- loading, empty, and error states

## Target UX direction

- live run visualization
- issue and file navigation
- clear analysis flow from CLI/API/UI
