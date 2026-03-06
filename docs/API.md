# API — PHPSage

Living operational API contract.

Formal OpenAPI contract: `docs/openapi.yaml`.

## Current status

Initial HTTP API scaffold is implemented.

## Update rule

This document must be updated in the same iteration where any endpoint is added or modified.

## AI environment notes

- AI provider can be configured with `AI_PROVIDER` (legacy-compatible) or `PHPSAGE_AI_PROVIDER`.
- RAG backend can be configured with `AI_RAG_BACKEND=filesystem|qdrant`.
- When `AI_RAG_BACKEND=qdrant`, ingestion/retrieval uses `QDRANT_URL` and `QDRANT_COLLECTION`.

## Endpoints

### Health

- `GET /healthz`
- Response `200` (text/plain): `ok`

- `GET /api/ai/health`
- Response `200`:

```json
{
	"status": "ok",
	"enabled": false,
	"activeProvider": null,
	"activeModel": null
}
```

- `enabled=true` when `PHPSAGE_AI_PROVIDER` is set (or when `OPENAI_API_KEY` is present and provider is not explicitly set).
- `activeModel` is populated from `PHPSAGE_AI_MODEL` when AI is enabled.

- Response `404` for unknown routes:

```json
{
	"error": "Not Found"
}
```

### Runs

- `GET /api/runs`
- Response `200`: array of run summaries sorted by `createdAt` desc

- `GET /api/runs/:runId`
- Response `200`: full run record
- Response `404`: run not found

- `GET /api/runs/:runId/source?file=<absolute-path>`
- Response `200`: source payload `{ file, content }`
- Response `400`: missing `file` query parameter
- Response `404`: run not found or source file not found/outside target path

- `GET /api/runs/:runId/files`
- Response `200`: `{ targetPath, files[] }` where each file has `{ path, issueCount, hasIssues }`
- Response `404`: run not found

- `POST /api/runs/start`
- Body:

```json
{
	"targetPath": "/workspace/examples/php-sample",
	"execute": true
}
```

- Response `201`: persisted run record with `status: "running"`
- Response `400`: invalid `targetPath` (`required`, `does not exist`, `must be a directory`)
- When `execute=true`, PHPStan is executed asynchronously and the run is updated via `log/finish` lifecycle.

- `POST /api/runs/:runId/log`
- Body:

```json
{
	"stream": "stdout",
	"message": "Running PHPStan..."
}
```

- Response `200`: updated run with appended log entry
- Response `400`: invalid payload (`stream` and `message` required)
- Response `404`: run not found

- `POST /api/runs/:runId/finish`
- Body:

```json
{
	"issues": [
		{
			"file": "src/Example.php",
			"line": 12,
			"message": "Example issue",
			"identifier": "example.identifier"
		}
	],
	"exitCode": 1
}
```

- Response `200`: updated run with `status: "finished"`
- Response `400`: invalid payload (`issues` and `exitCode` required)
- Response `404`: run not found

### AI (phase C in progress)

- `POST /api/ai/ingest`
- Body (optional):

```json
{
	"targetPath": "/workspace/rag"
}
```

- Response `202`: ingest job enqueued

```json
{
	"jobId": "uuid",
	"targetPath": "/workspace/rag",
	"status": "queued",
	"createdAt": "2026-01-01T00:00:00.000Z",
	"updatedAt": "2026-01-01T00:00:00.000Z",
	"startedAt": null,
	"finishedAt": null,
	"error": null,
	"stats": null
}
```

- If `targetPath` is omitted, server uses `AI_INGEST_DEFAULT_TARGET` or `/workspace/rag`.
- The ingest processor walks files recursively (excluding `.git`, `node_modules`, `dist`, `coverage`, `data`) and computes stats:
	- `filesIndexed`: number of indexed files
	- `chunksIndexed`: chunks estimated as `ceil(lineCount / 120)` per indexed file
- Explain/suggest retrieval uses top-k context documents controlled by `AI_RAG_TOP_K` (default `3`).

- `GET /api/ai/ingest?limit=<n>`
- Response `200`: array with most recent ingest jobs (default `limit=10`)

- `GET /api/ai/ingest/:jobId`
- Response `200`: current ingest job state
- Response `404`: `{ "error": "Ingest job not found" }`

- `GET /api/ai/ingest/latest`
- Response `200`: most recently started ingest job in current server lifecycle
- Response `404`: `{ "error": "Ingest job not found" }`

- Auto-ingest can be enabled with `AI_RAG_AUTO_INGEST_ON_BOOT=true`.

- `POST /api/ai/explain`
- Body:

```json
{
	"issueMessage": "Undefined variable: $foo",
	"issueIdentifier": "variable.undefined",
	"filePath": "src/Example.php",
	"line": 12,
	"sourceSnippet": "$bar = $foo;"
}
```

- Response `200`: deterministic fallback explanation payload

```json
{
	"explanation": "...",
	"recommendations": ["...", "..."],
	"source": "fallback",
	"provider": "openai",
	"fallbackReason": "LLM provider is not configured for explain yet",
	"contextItems": [
		{
			"sourcePath": "variable.undefined.md",
			"identifier": "variable.undefined",
			"content": "...",
			"score": 0.91
		}
	],
	"usage": null,
	"debug": null
}
```

- Response `400`: invalid payload (`issueMessage is required`)

- `POST /api/ai/suggest-fix`
- Body:

```json
{
	"issueMessage": "Undefined variable: $undefinedVariable",
	"issueIdentifier": "variable.undefined",
	"filePath": "src/Broken.php",
	"line": 7,
	"sourceSnippet": "return $undefinedVariable + $value;"
}
```

- Response `200`: deterministic fallback suggest-fix payload

```json
{
	"proposedDiff": "--- a/src/Broken.php\n+++ b/src/Broken.php\n@@ -7,1 +7,1 @@\n-return $undefinedVariable + $value;\n+return $value + $value;",
	"rationale": "...",
	"source": "fallback",
	"provider": "openai",
	"fallbackReason": "LLM provider is not configured for suggest-fix yet",
	"contextItems": [
		{
			"sourcePath": "variable.undefined.md",
			"identifier": "variable.undefined",
			"content": "...",
			"score": 0.91
		}
	],
	"usage": null,
	"debug": null
}
```

- Response `400`: invalid payload (`issueMessage is required`)
