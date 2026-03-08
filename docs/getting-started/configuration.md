# Variables de configuración

PHPSage se configura mediante variables de entorno definidas en el archivo `.env` de la raíz del proyecto. Al ejecutar `make local/up` por primera vez, se crea automáticamente a partir de `.env.example`.

## Configuración de IA

### Proveedor de IA

| Variable | Descripción | Valores |
|---|---|---|
| `AI_PROVIDER` | Selecciona el proveedor de IA | `ollama` (local) o `openai` (remoto) |

### Ollama (proveedor local)

| Variable | Descripción | Valor por defecto |
|---|---|---|
| `OLLAMA_BASE_URL` | URL del servicio Ollama | `http://ollama:11434` |
| `OLLAMA_MODEL` | Modelo a utilizar | `llama3.2` |

### OpenAI (proveedor remoto)

| Variable | Descripción | Valor por defecto |
|---|---|---|
| `OPENAI_BASE_URL` | Endpoint base de la API | `https://api.openai.com` |
| `OPENAI_API_KEY` | Clave de API (obligatorio si usas OpenAI) | — |
| `OPENAI_MODEL` | Modelo a utilizar | `gpt-4o-mini` |

### Opciones generales de IA

| Variable | Descripción | Valor por defecto |
|---|---|---|
| `AI_HEALTH_TIMEOUT_MS` | Timeout en milisegundos para las probes de salud | `5000` |
| `AI_DEBUG_LLM_IO` | Incluir payloads del LLM en respuestas de debug | `true` o `false` |

## Configuración de RAG

| Variable | Descripción | Valor por defecto |
|---|---|---|
| `AI_RAG_BACKEND` | Backend de recuperación de contexto | `filesystem` o `qdrant` |
| `QDRANT_URL` | URL de Qdrant | `http://qdrant:6333` |
| `QDRANT_COLLECTION` | Nombre de la colección vectorial | `phpsage-rag` |
| `AI_INGEST_DEFAULT_TARGET` | Ruta por defecto para la ingesta | `/workspace/docs/phpstan` |
| `AI_RAG_DIRECTORY` | Directorio documental en modo filesystem | `docs/phpstan` |
| `AI_RAG_TOP_K` | Número de fragmentos recuperados por consulta | `3` |
| `AI_RAG_AUTO_INGEST_ON_BOOT` | Ejecutar ingesta automática al arrancar | `true` o `false` |

## Configuración de despliegue remoto

Estas variables solo son necesarias si vas a desplegar en un servidor remoto.

| Variable | Descripción | Valor por defecto |
|---|---|---|
| `PHPSAGE_PUBLIC_HOST` | Dominio público en remoto | — |
| `PHPSAGE_TLS_CERT_PATH` | Ruta del certificado TLS (para Traefik) | — |
| `PHPSAGE_TLS_KEY_PATH` | Ruta de la clave privada TLS | — |
| `PHPSAGE_DEPLOY_SOURCE` | Fuente del despliegue | `git` o `local` |

## Notas prácticas

!!! tip "Para trabajo local"
    Si vas a trabajar solo en local, normalmente basta con dejar `AI_PROVIDER=ollama`. El `.env.example` ya trae valores por defecto funcionales.

!!! tip "Para usar OpenAI"
    Cambia `AI_PROVIDER=openai` y define como mínimo `OPENAI_API_KEY` y `OPENAI_MODEL`.

!!! warning "Secretos en remoto"
    Las variables sensibles (`OPENAI_API_KEY`, credenciales de infraestructura) nunca deben quedar sin configurar en entornos remotos si quieres probar la IA con un proveedor real.
