# Especificación OpenAPI

La especificación formal de la API de PHPSage está definida en formato OpenAPI 3.1.0.

## Ubicación

El archivo de la especificación está en:

```
docs/openapi.yaml
```

## Swagger UI

Cuando PHPSage está levantado, la especificación se puede explorar de forma interactiva en Swagger UI:

| Entorno | URL |
|---|---|
| Local | `http://localhost:8081` |
| Remoto | `https://<dominio>/docs/` |

## Contenido

La especificación cubre:

- **Health endpoints**: `/healthz`, `/api/ai/health`
- **Runs**: CRUD completo sobre runs, logs, finish, source y files
- **AI/RAG**: ingest, explain, suggest-fix

### Schemas definidos

| Schema | Descripción |
|---|---|
| `AiHealthResponse` | Estado de salud de la integración IA |
| `AiProviderHealth` | Estado de un proveedor individual |
| `AiRagHealth` | Estado del sistema RAG |
| `AiExplainRequest` / `AiExplainResponse` | Petición y respuesta de explain |
| `AiSuggestFixRequest` / `AiSuggestFixResponse` | Petición y respuesta de suggest-fix |
| `AiIngestStartRequest` / `AiIngestJob` | Ingesta de documentación |
| `AiIngestProgress` / `AiIngestStats` | Progreso y estadísticas de ingesta |
| `AiUsage` | Tokens consumidos por el LLM |
| `AiDebugPayload` | Payload de debug de la IA |
| `AiRagContextItem` | Fragmento de contexto recuperado por RAG |
| `RunRecord` / `RunSummary` | Detalle y resumen de un run |
| `RunIssue` | Issue individual de PHPStan |
| `RunLogEntry` | Entrada de log de un run |
| `ErrorResponse` | Respuesta de error estándar |

## Regla de actualización

Cuando el comportamiento de un endpoint cambia, se deben actualizar tanto el contrato funcional (`docs/api/index.md`) como la especificación OpenAPI (`docs/openapi.yaml`) en la misma iteración.
