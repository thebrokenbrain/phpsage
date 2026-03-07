# API - PHPSage

Living operational API contract.

Formal contract: `docs/openapi.yaml`.

## Current API Status

Implemented and active in `apps/server/src/interfaces/http-server.ts`.

## Environment Notes

- AI provider selection:
  - `PHPSAGE_AI_PROVIDER`
  - fallback legacy: `AI_PROVIDER`
- AI model:
  - `PHPSAGE_AI_MODEL`
  - provider fallback vars: `OPENAI_MODEL`, `OLLAMA_MODEL`
- RAG backend mode: `AI_RAG_BACKEND=filesystem|qdrant`
- RAG retrieval depth: `AI_RAG_TOP_K`
- Auto ingest on server boot: `AI_RAG_AUTO_INGEST_ON_BOOT=true`
- Ingest default target: `AI_INGEST_DEFAULT_TARGET` (default `/workspace/docs/phpstan`)
- AI debug payload toggle: `AI_DEBUG_LLM_IO=true`

## Endpoints

### Health

- `GET /healthz`
  - `200 text/plain`: `ok`

- `GET /api/ai/health`
  - `200 application/json`
  - shape:
    - `status: "ok" | "degraded"`
    - `enabled: boolean`
    - `activeProvider: string | null`
    - `activeModel: string | null`
    - `timestamp: ISO string`
    - `providers[]: { provider, url, status, latencyMs, error }`

### Runs

- `GET /api/runs`
  - `200`: run summaries

- `GET /api/runs/:runId`
  - `200`: full run record
  - `404`: `{ "error": "Run not found" }`

- `DELETE /api/runs/:runId`
  - `204`: run deleted
  - `404`: `{ "error": "Run not found" }`

- `POST /api/runs/start`
  - body:
    - `targetPath: string` (required)
    - `execute?: boolean`
  - `201`: created run
  - `400`: invalid target path
  - if `execute=true`, server runs phpstan and finalizes the run asynchronously

- `POST /api/runs/:runId/log`
  - body: `{ "stream": "stdout" | "stderr", "message": string }`
  - `200`: updated run
  - `400`: invalid payload
  - `404`: run not found

- `POST /api/runs/:runId/finish`
  - body: `{ "issues": RunIssue[], "exitCode": number }`
  - `200`: updated run
  - `400`: invalid payload
  - `404`: run not found

- `GET /api/runs/:runId/source?file=<path>`
  - `200`: `{ "file": "...", "content": "..." }`
  - `400`: missing `file`
  - `404`: run/source not found

- `GET /api/runs/:runId/files`
  - `200`: `{ "targetPath": string, "files": [{ path, issueCount, hasIssues }] }`
  - `404`: run not found

### AI / RAG

- `POST /api/ai/ingest`
  - body optional: `{ "targetPath": string }`
  - `202`: ingest job

- `GET /api/ai/ingest?limit=<n>&status=<queued|running|completed|failed>`
  - `200`: recent jobs (optionally filtered)
  - `400`: invalid `status`

- `GET /api/ai/ingest/latest`
  - `200`: latest job
  - `404`: `{ "error": "Ingest job not found" }`

- `GET /api/ai/ingest/:jobId`
  - `200`: job detail
  - `404`: `{ "error": "Ingest job not found" }`

- `POST /api/ai/explain`
  - body:
    - `issueMessage` (required)
    - optional: `issueIdentifier`, `filePath`, `line`, `sourceSnippet`
  - `200`: explain payload
  - `400`: `{ "error": "issueMessage is required" }`

- `POST /api/ai/suggest-fix`
  - body:
    - `issueMessage` (required)
    - optional: `issueIdentifier`, `filePath`, `line`, `sourceSnippet`
  - `200`: suggest-fix payload
  - `400`: `{ "error": "issueMessage is required" }`

## AI Response Notes

Explain/suggest-fix response includes:

- `source: "llm" | "fallback"`
- `provider`
- `fallbackReason: string | null`
- `usage: { model, inputTokens, outputTokens, totalTokens } | null`
- `debug: AiDebugPayload | null`

Suggest-fix also includes:

- `proposedDiff: string | null`
- `rejectedReason: string | null`

When guardrails reject a patch, fallback returns `proposedDiff: null` and sets `rejectedReason`.

## Debug Payload

When `AI_DEBUG_LLM_IO=true`, debug payload may include:

- `strategy`
- `endpoint`
- `prompt` (combined)
- `systemPrompt` (optional)
- `userPrompt` (optional)
- `requestBody`
- `rawResponse`

## Update Rule

If endpoint behavior changes, update `docs/API.md` and `docs/openapi.yaml` in the same iteration.
