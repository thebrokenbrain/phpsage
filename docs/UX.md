# UX — PHPSage

User experience guide for PHPSage.

## Current status

A minimal Dashboard is implemented with:

- runs table backed by `GET /api/runs`
- selectable run detail panel backed by `GET /api/runs/:runId`
- files navigator in detail backed by `GET /api/runs/:runId/files`
- paginated issues and logs sections in run detail
- source preview for selected issue backed by `GET /api/runs/:runId/source`
- URL query-state for selected run, file, issue, and logs page (`?runId=...&file=...&issue=...&logPage=...`) with reload restore (including pagination context)
- browser back/forward navigation restores the same URL state (`popstate` handling)
- issue/log navigation keeps local context synchronized without re-fetching run detail when run does not change
- selected run auto-refreshes every 2s while status is `running` (list + detail polling)
- manual refresh action
- loading, empty, and error states

## Target UX direction

- live run visualization
- issue and file navigation
- clear analysis flow from CLI/API/UI
