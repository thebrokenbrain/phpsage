# PHPSage

PHPSage es una plataforma Docker-first para ejecutar análisis estático de proyectos PHP con una experiencia operativa moderna (CLI + API + UI), trazabilidad de ejecuciones y evolución progresiva hacia asistencia IA segura.

## a) Descripción general del proyecto

PHPSage centraliza el ciclo completo de análisis:

- lanzamiento de runs desde CLI
- procesamiento y persistencia de resultados
- visualización en interfaz web con estado y logs en vivo
- extensibilidad por fases para capacidades avanzadas (watch, insights, IA/RAG)

El objetivo es mantener paridad funcional con la visión del producto mientras se mejora la arquitectura interna y la mantenibilidad.

## b) Stack tecnológico utilizado

Estado actual del repositorio:

- Monorepo con npm workspaces
- TypeScript (`tsc -b`) como base de compilación
- Node.js como runtime de herramientas y servicios
- Estructura preparada para apps `cli`, `server`, `web` y paquete compartido `shared`

Stack objetivo de producto (a completar en iteraciones):

- CLI en Node.js/TypeScript
- API HTTP para ciclo de runs
- Frontend React + Vite + TypeScript
- Docker Compose para ejecución reproducible
- Integraciones IA/RAG por proveedor configurable

## c) Información sobre su instalación y ejecución

### Requisitos mínimos

- Docker Desktop (o daemon Docker compatible)
- `docker compose`

### Configuracion de entorno (IA/RAG)

- Plantilla disponible en `.env.example`.
- Para overrides locales, crear `.env` y ajustar variables como `AI_PROVIDER`, `AI_RAG_BACKEND`, `AI_RAG_TOP_K`, `OPENAI_API_KEY`.
- `docker compose` usa por defecto `.env.example`; para usar otro fichero: `PHPSAGE_ENV_FILE=.env docker compose up --build`.
- `AI_RAG_BACKEND=filesystem|qdrant` selecciona retrieval/indexación en filesystem local o Qdrant.
- `AI_RAG_AUTO_INGEST_ON_BOOT=true` lanza una ingesta automática al arrancar el server (target: `AI_INGEST_DEFAULT_TARGET`).

### Instalación y arranque (flujo recomendado)

```bash
docker compose up --build -d phpsage-server
```

Servicios de soporte IA disponibles en compose:

- `qdrant` (`:6333`)
- `ollama` (`:11434`)

### Comandos disponibles actualmente

```bash
docker compose run --rm phpsage-cli npm run build
./scripts/smoke-no-ai.sh
./scripts/smoke-ollama.sh
./scripts/smoke-openai.sh
./scripts/reindex-rag.sh --wait
docker compose up --build -d phpsage-server
docker compose up --build -d phpsage-web
docker compose up --build -d api-docs
curl http://localhost:8080/healthz
docker compose down --remove-orphans
```

> Nota: el uso de Node/npm en host es opcional para desarrollo local, no obligatorio para operar el proyecto.

## d) Estructura del proyecto

```text
phpsage/
  apps/
    cli/
    server/
    web/
  packages/
    shared/
  docs/
  rag/
  examples/
    php-sample/
    php-sample-ok/
  assets/
    logo/
  data/
    runs/
  scripts/
  package.json
  tsconfig.base.json
  tsconfig.json
```

### Propósito por área

- `apps/cli`: comandos de terminal y orquestación de análisis.
- `apps/server`: API y ciclo de vida de runs.
- `apps/web`: interfaz visual del producto.
- `packages/shared`: contratos y utilidades puras reutilizables.
- `docs`: especificaciones funcionales y contrato API.
- `examples`: proyectos de muestra para pruebas y smoke.
- `data/runs`: persistencia local de ejecuciones.

## e) Funcionalidades principales

Funcionalidades objetivo del producto:

- ejecución de análisis PHPStan con streaming de logs
- persistencia e historial de runs
- consulta por API de estado, detalle y artefactos de ejecución
- visualización web de logs, issues y navegación por run
- auto-run en fases de paridad no-IA
- explain y suggest-fix con guardarraíles en fase IA/RAG

Estado actual:

- bootstrap de monorepo TypeScript operativo
- estructura base preparada para desarrollo por fases
- endpoint inicial de servidor implementado: `GET /healthz`
- `GET /healthz` responde `ok` en texto plano
- inicio de runs implementado: `POST /api/runs/start` con persistencia en `data/runs`
- lifecycle parcial de runs implementado: `POST /api/runs/:runId/log` y `POST /api/runs/:runId/finish`
- lectura de runs implementada: `GET /api/runs` y `GET /api/runs/:runId`
- lectura de source por run implementada: `GET /api/runs/:runId/source?file=...`
- listado de archivos por run implementado: `GET /api/runs/:runId/files`
- ejecución real de PHPStan desde server habilitada con `POST /api/runs/start` usando `execute=true`
- CLI base implementada: `phpsage phpstan analyse <path>` con sincronización `start/log/finish`
- modo watch CLI implementado: `phpsage phpstan analyse <path> --watch [--watch-interval <ms>]`
- watch CLI re-ejecuta análisis al detectar cambios en `.php`, `phpstan.neon`, `phpstan.neon.dist` y `composer.json`
- watch CLI soporta `--watch-debounce`, `--watch-no-initial`, `--watch-quiet` y `--watch-ignore <dir1,dir2>`
- watch CLI soporta `--watch-max-cycles <n>` para cortar automáticamente tras `n` ciclos
- watch CLI permite definir extensiones y archivos observados con `--watch-ext` y `--watch-files`
- watch CLI finaliza de forma limpia en `SIGINT`/`SIGTERM` con resumen de ciclos
- watch CLI valida que el `targetPath` exista y sea directorio antes de arrancar
- watch CLI muestra telemetría básica del watcher (número de archivos monitorizados y variación al detectar cambios)
- watch CLI detiene el loop de forma determinista cuando alcanza `--watch-max-cycles` e informa motivo de parada
- CLI soporta `--help`/`-h` y `--version`/`-v`
- parser CLI valida flags desconocidas y flags con valor requerido para fallar rápido con error explícito
- envío de eventos `log` y `finish` del lifecycle CLI incorpora reintentos ante fallos transitorios de red
- CLI soporta `--timeout-ms <ms>` para abortar ejecuciones de PHPStan colgadas (exit code `124`)
- CLI soporta `--json-summary` para emitir resumen estructurado (JSON) por ejecución/ciclo de watch
- tests de integración CLI cubren `watch`, `timeout` y `json-summary`
- tests de CLI también cubren casos negativos de parser (flags inválidas/valores faltantes/target inválido)
- tests de server migrados para `RunService` y `FileRunRepository`
- tests HTTP de server cubren validación de `POST /api/runs/start` para `targetPath`
- tests HTTP de server también cubren `GET /api/runs`, `GET /api/runs/:runId`, `POST /api/runs/:runId/log`, `POST /api/runs/:runId/finish`, `GET /api/runs/:runId/source` y `GET /api/runs/:runId/files`
- endpoint IA de health implementado: `GET /api/ai/health` (estado/configuración activa por entorno + probes `openai/ollama/qdrant` con latencia/error)
- endpoint IA de ingest implementado: `POST /api/ai/ingest` (creación de job asíncrono)
- endpoint IA de estado de ingest implementado: `GET /api/ai/ingest/:jobId`
- endpoint IA de histórico reciente de ingest implementado: `GET /api/ai/ingest?limit=<n>`
- endpoint IA de histórico de ingest permite filtro por estado: `GET /api/ai/ingest?status=<queued|running|completed|failed>`
- comando CLI de ingest implementado: `phpsage rag ingest [--target-path <path>] [--wait]`
- comando CLI permite consultar histórico: `phpsage rag ingest --list [--status <...>] [--limit <n>]`
- ingest IA procesa recursivamente el filesystem objetivo y calcula `filesIndexed`/`chunksIndexed`
- jobs de ingest persisten en `data/ai/ingest-jobs/<jobId>.json`
- corpus de conocimiento para ingest incluido en `rag/` (copiado desde `phpsage-legacy/docs/rag`)
- target por defecto de ingest: `/workspace/rag` (o `AI_INGEST_DEFAULT_TARGET`)
- endpoint IA de explain implementado: `POST /api/ai/explain` (respuesta fallback determinista en esta fase)
- endpoint IA de suggest-fix implementado: `POST /api/ai/suggest-fix` (diff fallback determinista en esta fase)
- con `AI_PROVIDER=openai` y `OPENAI_API_KEY`, explain/suggest-fix intentan LLM real (`/v1/responses`) con fallback robusto a `/v1/chat/completions`
- con `AI_PROVIDER=ollama`, explain/suggest-fix usan cliente Ollama real (`/api/generate`)
- `suggest-fix` activa guardarraíles de patch: validación de diff unificado + chequeos heurísticos + `php -l` antes de aceptar propuesta LLM
- explain/suggest-fix enriquecen respuesta con `contextItems` recuperados desde corpus `rag/`
- `AI_RAG_TOP_K` permite ajustar cuántos contextos recuperar por petición IA (default `3`)
- panel `AI Assist` permite expandir/colapsar contenido de contexto recuperado para inspección rápida
- dashboard incluye panel `Recent Ingest Jobs` con refresco manual y snapshot de estados/estadísticas
- panel `Recent Ingest Jobs` permite filtrar por estado (`all|queued|running|completed|failed`)
- cada job de ingest en dashboard se puede expandir para ver tiempos, `jobId` y error completo
- smoke no-IA reproducible (`./scripts/smoke-no-ai.sh`) validando dos rutas E2E: muestra con errores (`exitCode=1`) y muestra limpia (`exitCode=0`)
- contrato OpenAPI disponible en `docs/openapi.yaml` y visualizable con `api-docs` en `http://localhost:8081`
- web mínima implementada en `http://localhost:5173` con listado de runs desde `GET /api/runs`
- selección por defecto prioriza runs en estado `running` cuando existen
- filtro por estado en tabla de runs (`all`, `running`, `finished`) persistido en URL
- ordenación de runs por fecha de actualización (asc/desc)
- ordenación de runs persistida en URL
- contadores en dashboard para runs totales/running/finished
- chips visuales con controles/filtros activos
- chips incluyen estado/intervalo de auto-run cuando está activo
- indicador de hora de último refresco exitoso en dashboard
- acción rápida `Jump to running` para seleccionar el run activo más reciente
- acción `Clear selection` para limpiar run seleccionado y ocultar detalle
- detalle de run en web implementado al seleccionar fila (`GET /api/runs/:runId`)
- panel de ayuda cuando no hay run seleccionado para guiar navegación
- cabecera de detalle muestra timestamps de creación/actualización
- acción `Copy run ID` en detalle de run
- inicio de run desde UI por `targetPath` usando `POST /api/runs/start` con `execute=true`
- `targetPath` del formulario de inicio persistido en URL para compartir contexto
- recuperación del último `targetPath` desde localStorage cuando no viene en URL
- acción para precargar en el formulario el `targetPath` del run seleccionado
- presets rápidos de `targetPath` para ejemplos comunes
- `Enter` en input de `targetPath` dispara inicio de run
- botón `Start run` deshabilitado si `targetPath` está vacío
- feedback de error del starter se limpia al cambiar `targetPath`
- acción rápida `Reset target` para volver al path por defecto de ejemplo
- panel de detalle web ampliado con paginación de issues y logs
- filtro local de texto en panel de logs
- sección `Logs` colapsable/expandible en detalle
- filtro de logs persistido en URL
- filtro por stream (`stdout`/`stderr`) en panel de logs
- filtro de stream de logs persistido en URL
- acción rápida `Clear log filters` en panel de logs
- estado colapsado/expandido de secciones de detalle persistido en URL
- filas de issues muestran identificador de PHPStan cuando existe
- filtro local de texto en panel de issues
- sección `Issues` colapsable/expandible en detalle
- filtro de issues persistido en URL
- filtro de presencia de identificador en panel de issues
- filtro de identificador de issues persistido en URL
- acción rápida `Clear issue filters` en panel de issues
- preview de source en web para issue seleccionado (`GET /api/runs/:runId/source`)
- sección `Source Preview` colapsable/expandible en detalle
- preview de source con numeración y resaltado de línea activa del issue
- navegador de archivos por run en web (`GET /api/runs/:runId/files`)
- sección `Files` colapsable/expandible en detalle
- filtro por ruta en navegador de archivos persistido en URL
- acción en panel Files para volver del override de archivo al contexto del issue activo
- estado básico en URL de la web (`runId`, `file`, `issue`, `logPage`) para restaurar selección al recargar
- navegación atrás/adelante del navegador restaurando ese mismo estado URL
- navegación de issue/log en detalle sin refetch innecesario del run cuando no cambia `runId`
- auto-refresh ligero en web cada 2s para run seleccionado en estado `running` (lista + detalle)
- refresco en vivo del navegador de archivos en ese ciclo de auto-refresh
- indicador visual `Live updating` en detalle cuando el run está en ejecución
- toggle en cabecera para activar/desactivar live polling
- estado del toggle de live polling persistido en URL
- selector en cabecera para intervalo de polling (`2s`, `5s`, `10s`)
- intervalo de polling persistido en URL
- controles en cabecera para auto-run (toggle + intervalo `10s`/`15s`/`30s`/`60s`)
- toggle `Pause when hidden` para pausar auto-run si la pestaña está oculta
- selector `Auto max failures` (`1`/`3`/`5`) para limitar fallos automáticos consecutivos
- modo de target para auto-run (`starter` o target del run seleccionado)
- auto-run dispara análisis periódicos cuando no hay un run `running`
- auto-run aplica backoff temporal del intervalo tras fallos automáticos
- resumen de dashboard muestra estado y timestamp de último auto-run
- el timestamp de último auto-run solo refleja disparos del scheduler (no `Run now` manual)
- estado, intervalo, modo de target y ajustes de resiliencia de auto-run persistidos en URL
- restauración de configuración de auto-run desde localStorage si la URL no define estado auto-run
- indicador visual cuando auto-run está esperando a que termine un run activo
- contador visible del tiempo restante hasta el próximo auto-run
- al desactivar auto-run, el contador vuelve al intervalo completo configurado
- el contador de auto-run se reinicia tras un inicio de run exitoso
- resumen muestra intervalo efectivo de auto-run (incluyendo backoff)
- resumen muestra contador de disparos auto-run exitosos en la sesión actual
- acción `Reset auto count` en cabecera
- acción `Reset auto failures` en cabecera
- acción `Clear auto status` en cabecera para limpiar timestamp de último auto-run
- resumen muestra último error de auto-run cuando falla un disparo automático
- resumen incluye contador de fallos de auto-run en la sesión actual
- resumen incluye contador de fallos consecutivos mientras hay backoff
- si auto-run se desactiva tras fallo, se muestra motivo de pausa
- acción `Run now` en cabecera usando el target resuelto según el modo auto-run
- indicador cuando el modo `selected` cae en fallback al `starter target` por no haber run seleccionado
- auto-run se desactiva automáticamente si un disparo automático falla al iniciar run
- acción rápida `Re-enable auto-run` para reactivar el scheduler
- auto-run no se dispara cuando `targetPath` está vacío
- acción `Copy link` para compartir el estado actual del dashboard
- acción `Reset controls` para restaurar controles del dashboard
- acción rápida `API docs` desde cabecera del dashboard
- dashboard consulta `GET /api/ai/health` y muestra estado LLM (`ON/OFF`) + proveedor/modelo activos
- panel `AI Assist` en detalle de run para issue activo, con carga contextual de `explain` y `suggest-fix`
- panel `AI Assist` renderiza recomendaciones y diff propuesto (`proposedDiff`) en formato legible

### Verificación rápida del endpoint inicial

```bash
docker compose run --rm phpsage-cli npm run build
docker compose up --build -d phpsage-server
curl http://localhost:8080/healthz
curl -X POST http://localhost:8080/api/runs/start \
  -H "Content-Type: application/json" \
  -d '{"targetPath":"/workspace/examples/php-sample"}'
docker compose down --remove-orphans
```

---

Este README se mantiene de forma incremental y debe reflejar siempre el estado real del proyecto.
