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
- dashboard shows chips for currently active controls/filters
- active controls chips include auto-run state/interval when enabled
- dashboard summary includes last successful refresh time
- header includes `Jump to running` quick action
- header includes `Clear selection` action to hide run detail
- selectable run detail panel backed by `GET /api/runs/:runId`
- when no run is selected, dashboard shows helper panel to guide next action
- run detail header includes created/updated timestamps
- run detail includes `Copy run ID` action
- files navigator in detail backed by `GET /api/runs/:runId/files`
- Files section can be collapsed/expanded
- files navigator includes search filter by path persisted in URL query-state
- collapsed/expanded state of detail sections is persisted in URL query-state
- files panel includes explicit action to return from manual file override to selected issue context
- paginated issues and logs sections in run detail
- logs panel includes local text filter with paginated result set
- Logs section can be collapsed/expanded
- log text filter is persisted in URL query-state (`logQuery`)
- logs panel supports stream filter (`all`, `stdout`, `stderr`)
- log stream filter is persisted in URL query-state (`logStream`)
- logs panel includes `Clear log filters` action
- issue rows display PHPStan identifier when available
- issues panel includes local text filter with paginated result set
- Issues section can be collapsed/expanded
- issue text filter is persisted in URL query-state (`issueQuery`)
- issues panel supports identifier presence filter (`all`, `with`, `without`)
- issue identifier filter is persisted in URL query-state (`issueIdentifier`)
- issues panel includes `Clear issue filters` action
- source preview for selected issue backed by `GET /api/runs/:runId/source`
- Source Preview section can be collapsed/expanded
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
- header includes auto-run on/off toggle and interval selector (`10s`, `15s`, `30s`)
- auto-run supports target mode (`starter` or `selected run target`)
- auto-run scheduler starts analysis at configured interval when no run is currently `running`
- dashboard summary shows auto-run status and last auto-run timestamp
- `last auto-run` only tracks scheduler-triggered starts (manual `Run now` does not update it)
- auto-run toggle, interval and target mode are persisted in URL query-state (`auto`, `autoInterval`, `autoTarget`)
- auto-run settings are restored from localStorage when URL has no explicit auto-run query-state
- dashboard indicates when auto-run is waiting for an active run to finish
- dashboard shows countdown to next auto-run while enabled
- countdown resets to full interval when auto-run is disabled
- countdown resets after a successful run start
- dashboard summary includes successful auto-run trigger count for current session
- header includes `Reset auto count` action
- header includes `Clear auto status` action to remove last auto-run timestamp
- auto-run is automatically disabled if auto-triggered run start fails
- dashboard summary exposes last auto-run error when an automatic trigger fails
- dashboard summary includes auto-run failure counter for current session
- when auto-run is disabled after failure, summary shows pause reason
- header includes `Run now` action using currently resolved run target
- `Run now` resolves target with the same mode as auto-run scheduler (`starter` or `selected`)
- summary indicates when `selected` mode is using starter fallback because no run is selected
- auto-run scheduler is skipped while starter target path is empty
- header includes `Re-enable auto-run` quick action
- header includes `Copy link` action for sharing current dashboard URL state
- header includes `Reset controls` action to restore default dashboard controls
- header includes `API docs` quick access action
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
