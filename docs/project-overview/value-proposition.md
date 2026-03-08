# Qué aporta PHPSage

## La diferencia frente a usar PHPStan directamente

Ejecutar PHPStan directamente produce una lista de errores en la terminal. PHPSage toma esa misma lista y la transforma en una experiencia de trabajo más completa:

| Aspecto | PHPStan solo | PHPStan + PHPSage |
|---|---|---|
| Formato de salida | Texto plano o JSON en terminal | Interfaz web navegable |
| Navegación | Lista plana por archivo | Agrupación por archivo, filtros, vista de código fuente |
| Explicación del error | Mensaje técnico breve | Explicación generada por IA con contexto documental |
| Sugerencia de corrección | No incluida | Diff propuesto por IA con guardrails de validación |
| Historial de análisis | No hay persistencia | Runs almacenados y consultables |
| Estadísticas | No incluidas | KPIs, distribución por tipo de error, charts |

## Piezas principales de PHPSage

PHPSage está organizado como un monorepo con estos componentes:

### CLI (`apps/cli/`)

La interfaz de línea de comandos que permite:

- Lanzar análisis de PHPStan: `phpsage phpstan analyse <path>`
- Levantar la aplicación: `phpsage app`
- Ejecutar la ingesta de documentación para RAG: `phpsage rag ingest`

### Servidor API (`apps/server/`)

El backend HTTP que gestiona:

- El ciclo de vida de los runs (crear, consultar, finalizar, eliminar)
- La lectura del código fuente de los archivos analizados
- Los endpoints de IA: explicar un issue, sugerir un fix
- La ingesta y recuperación de contexto RAG
- El health check del sistema y de los proveedores de IA

### Interfaz web (`apps/web/`)

Una aplicación React/Vite con tres vistas principales:

- **Dashboard**: lista de runs, detalle de un run con logs, issues, código fuente y navegador de archivos.
- **Insights**: KPIs y gráficos de distribución de errores por tipo.
- **Issue**: vista detallada de un issue con navegación al código y panel de asistencia IA.

## Despliegue de la demo

El repositorio también incluye infraestructura y automatización de despliegue para publicar una demo accesible en remoto. Esta parte no forma parte del núcleo funcional de PHPSage, sino de su operación externa.

La infraestructura se define en `infra/` con Pulumi y TypeScript y cubre:

- Servidor en Hetzner Cloud
- Firewall y SSH keys
- DNS en Cloudflare
- Protección Zero Trust con Cloudflare Access

La documentación específica de esta parte está en [deployment/infrastructure.md](../deployment/infrastructure.md).

## Sistema de IA y RAG

La capa de IA de PHPSage es **opcional**. El sistema funciona sin ella: la navegación de runs, issues, archivos y código fuente funciona independientemente de si hay un proveedor de IA configurado.

Cuando la IA está activa, PHPSage ofrece dos funcionalidades:

### Explain

Dado un issue de PHPStan, el sistema genera una explicación clara del error: qué significa, por qué ocurre y qué debería revisar el desarrollador.

### Suggest Fix

Dado un issue, el sistema propone un diff concreto para corregir el error. Esta propuesta pasa por un sistema de **guardrails** que valida que el diff sea aplicable y sintácticamente correcto antes de presentarlo al usuario. Si el diff no pasa la validación, el sistema informa al usuario del motivo del rechazo en lugar de mostrar un parche defectuoso.

### RAG (Retrieval-Augmented Generation)

Para enriquecer las respuestas de IA, PHPSage utiliza una base de conocimiento con más de 1.000 documentos sobre errores de PHPStan. Ese material describe los tipos de error más habituales, muestra ejemplos de código donde aparecen y recoge posibles formas de corregirlos.

Este corpus se indexa (ingesta) y se usa como contexto adicional en las consultas al modelo de IA. El backend de RAG puede ser:

- **Filesystem**: modo simple sin base de datos vectorial. Busca por coincidencia de identificadores.
- **Qdrant**: base de datos vectorial que permite búsqueda semántica sobre el corpus.

## Proveedores de IA soportados

| Proveedor | Tipo | Uso típico |
|---|---|---|
| Ollama | Local | Desarrollo y pruebas sin coste. Ejecuta modelos como `llama3.2` localmente. |
| OpenAI | Remoto | Entornos de producción o demo. Usa modelos como `gpt-5.4` o `gpt-5.3-codex`. |

La selección del proveedor se hace mediante la variable de entorno `AI_PROVIDER`.
