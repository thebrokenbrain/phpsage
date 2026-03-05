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
