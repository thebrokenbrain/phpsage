# API — PHPSage

Living operational API contract.

Formal OpenAPI contract: `docs/openapi.yaml`.

## Current status

Initial HTTP API scaffold is implemented.

## Update rule

This document must be updated in the same iteration where any endpoint is added or modified.

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
