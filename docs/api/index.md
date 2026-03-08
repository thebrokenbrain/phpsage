# Contrato funcional de la API

Contrato operativo de la API HTTP de PHPSage. La implementación vive en `apps/server/src/interfaces/http-server.ts`.

La especificación formal está disponible en [OpenAPI](openapi.md).

## Health

### `GET /healthz`

Health check básico del servidor.

- **`200`**: `ok` (text/plain)

### `GET /api/ai/health`

Estado de la integración con IA, incluyendo probes de proveedores y estado del RAG.

- **`200`**: payload JSON

Campos de la respuesta:

| Campo | Tipo | Descripción |
|---|---|---|
| `status` | `"ok"` \| `"degraded"` | Estado general |
| `enabled` | `boolean` | Si la IA está habilitada |
| `activeProvider` | `string` \| `null` | Proveedor activo |
| `activeModel` | `string` \| `null` | Modelo activo |
| `timestamp` | ISO string | Timestamp de la probe |
| `providers[]` | array | Estado de cada proveedor (provider, url, status, latencyMs, error) |
| `rag` | object | Estado del RAG (backend, status, progressPercent, targetPath, error) |

## Runs

### `GET /api/runs`

Lista resúmenes de todos los runs.

- **`200`**: array de run summaries

### `GET /api/runs/:runId`

Detalle completo de un run.

- **`200`**: run record
- **`404`**: `{ "error": "Run not found" }`

### `DELETE /api/runs/:runId`

Elimina un run.

- **`204`**: run eliminado
- **`404`**: `{ "error": "Run not found" }`

### `POST /api/runs/start`

Crea un nuevo run.

**Body**:

| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| `targetPath` | `string` | sí | Ruta del directorio a analizar |
| `execute` | `boolean` | no | Si `true`, el servidor ejecuta PHPStan y finaliza el run de forma asíncrona |

- **`201`**: run creado
- **`400`**: target path inválido

### `POST /api/runs/:runId/log`

Añade una línea de log a un run.

**Body**:

| Campo | Tipo | Requerido |
|---|---|---|
| `stream` | `"stdout"` \| `"stderr"` | sí |
| `message` | `string` | sí |

- **`200`**: run actualizado
- **`400`**: payload inválido
- **`404`**: run no encontrado

### `POST /api/runs/:runId/finish`

Marca un run como finalizado.

**Body**:

| Campo | Tipo | Requerido |
|---|---|---|
| `issues` | `RunIssue[]` | sí |
| `exitCode` | `number` | sí |

- **`200`**: run actualizado
- **`400`**: payload inválido
- **`404`**: run no encontrado

### `GET /api/runs/:runId/source?file=<path>`

Lee el contenido de un archivo fuente asociado a un run.

- **`200`**: `{ "file": "...", "content": "..." }`
- **`400`**: falta parámetro `file`
- **`404`**: run o archivo no encontrado

### `GET /api/runs/:runId/files`

Lista los archivos del directorio analizado con contadores de issues.

- **`200`**: `{ "targetPath": string, "files": [{ path, issueCount, hasIssues }] }`
- **`404`**: run no encontrado

## IA / RAG

### `POST /api/ai/ingest`

Inicia un job de ingesta de documentación asíncrono.

**Body** (opcional):

| Campo | Tipo | Descripción |
|---|---|---|
| `targetPath` | `string` | Directorio a ingestar. Por defecto usa `AI_INGEST_DEFAULT_TARGET`. |

- **`202`**: job de ingesta creado con snapshot de progreso

!!! info "Qdrant"
    Cuando se usa `AI_RAG_BACKEND=qdrant`, la ingesta se salta si el fingerprint del corpus no ha cambiado desde la última ingesta exitosa.

### `GET /api/ai/ingest`

Lista los jobs de ingesta recientes.

**Query params**:

| Param | Tipo | Descripción |
|---|---|---|
| `limit` | `integer` | Número máximo de jobs |
| `status` | `string` | Filtro: `queued`, `running`, `completed`, `failed` |

- **`200`**: array de jobs
- **`400`**: status inválido

### `GET /api/ai/ingest/latest`

Devuelve el job de ingesta más reciente.

- **`200`**: job con snapshot de progreso
- **`404`**: `{ "error": "Ingest job not found" }`

### `GET /api/ai/ingest/:jobId`

Detalle de un job de ingesta.

- **`200`**: job con progreso detallado (`filesProcessed`, `filesTotal`, `chunksProcessed`, `chunksTotal`, `progressPercent`) y stats (`skipped`, `skipReason`)
- **`404`**: `{ "error": "Ingest job not found" }`

### `POST /api/ai/explain`

Explica un issue de PHPStan usando IA.

**Body**:

| Campo | Tipo | Requerido |
|---|---|---|
| `issueMessage` | `string` | sí |
| `issueIdentifier` | `string` | no |
| `filePath` | `string` | no |
| `line` | `integer` | no |
| `sourceSnippet` | `string` | no |

- **`200`**: payload con explicación, recomendaciones, source, provider, usage, debug
- **`400`**: `{ "error": "issueMessage is required" }`

### `POST /api/ai/suggest-fix`

Sugiere una corrección para un issue de PHPStan usando IA con guardrails de validación.

**Body**: mismo formato que explain.

- **`200`**: payload con `proposedDiff`, `rationale`, source, provider, usage, debug
- **`400`**: `{ "error": "issueMessage is required" }`

Cuando los guardrails rechazan un parche, la respuesta devuelve `proposedDiff: null` y establece `rejectedReason`.

## Notas sobre respuestas de IA

Todos los endpoints de IA devuelven estos campos comunes:

| Campo | Descripción |
|---|---|
| `source` | `"llm"` o `"fallback"` |
| `provider` | Proveedor que generó la respuesta |
| `fallbackReason` | Motivo del fallback (si aplica) |
| `usage` | `{ model, inputTokens, outputTokens, totalTokens }` o `null` |
| `debug` | Payload de debug (si `AI_DEBUG_LLM_IO=true`) o `null` |

## Payload de debug

Cuando `AI_DEBUG_LLM_IO=true`, el campo `debug` puede incluir:

| Campo | Descripción |
|---|---|
| `strategy` | Estrategia usada para la generación |
| `endpoint` | Endpoint del proveedor al que se envió la petición |
| `prompt` | Prompt combinado |
| `systemPrompt` | System prompt (opcional) |
| `userPrompt` | User prompt (opcional) |
| `requestBody` | Body de la petición al proveedor |
| `rawResponse` | Respuesta cruda del proveedor |

## Variables de entorno relevantes

| Variable | Descripción |
|---|---|
| `AI_PROVIDER` | `ollama` o `openai` |
| `PHPSAGE_AI_MODEL` | Modelo de IA a usar (con fallback a `OPENAI_MODEL` u `OLLAMA_MODEL`) |
| `AI_RAG_BACKEND` | `filesystem` o `qdrant` |
| `AI_RAG_TOP_K` | Número de fragmentos de contexto recuperados |
| `AI_RAG_AUTO_INGEST_ON_BOOT` | Ejecutar ingesta automática al arrancar |
| `AI_INGEST_DEFAULT_TARGET` | Ruta por defecto para ingesta |
| `AI_DEBUG_LLM_IO` | Incluir payloads de debug en respuestas |
