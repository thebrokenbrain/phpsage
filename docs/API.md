# API — PHPSage

Living operational API contract.

## Current status

Initial HTTP API scaffold is implemented.

## Update rule

This document must be updated in the same iteration where any endpoint is added or modified.

## Endpoints

### Health

- `GET /healthz`
- Response `200`:

```json
{
	"status": "ok"
}
```

- Response `404` for unknown routes:

```json
{
	"error": "Not Found"
}
```

### Runs

- `POST /api/runs/start`
- Body:

```json
{
	"targetPath": "/workspace/examples/php-sample"
}
```

- Response `201`: persisted run record with `status: "running"`
- Response `400`: invalid `targetPath` (`required`, `does not exist`, `must be a directory`)
