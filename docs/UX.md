# UX — PHPSage

User experience guide for PHPSage.

## Current status

A minimal Dashboard is implemented with:

- runs table backed by `GET /api/runs`
- default run selection prefers an active `running` run when available
- runs table supports status filter (`all`, `running`, `finished`) persisted in URL query-state
- selectable run detail panel backed by `GET /api/runs/:runId`
- files navigator in detail backed by `GET /api/runs/:runId/files`
- files navigator includes search filter by path persisted in URL query-state
- paginated issues and logs sections in run detail
- issue rows display PHPStan identifier when available
- source preview for selected issue backed by `GET /api/runs/:runId/source`
- URL query-state for selected run, file, issue, and logs page (`?runId=...&file=...&issue=...&logPage=...`) with reload restore (including pagination context)
- browser back/forward navigation restores the same URL state (`popstate` handling)
- issue/log navigation keeps local context synchronized without re-fetching run detail when run does not change
- selected run auto-refreshes every 2s while status is `running` (list + detail polling)
- files navigator also auto-refreshes in that 2s cycle while selected run is `running`
- run detail shows a `Live updating` badge while polling is active
- manual refresh action
- loading, empty, and error states

## Target UX direction

- live run visualization
- issue and file navigation
- clear analysis flow from CLI/API/UI
