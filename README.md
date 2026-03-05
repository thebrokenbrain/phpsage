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

### Instalación y arranque (flujo recomendado)

```bash
docker compose up --build -d phpsage-server
```

### Comandos disponibles actualmente

```bash
docker compose run --rm phpsage-cli npm run build
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
  examples/
    php-sample/
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
- watch/auto-run en fases de paridad no-IA
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
- contrato OpenAPI disponible en `docs/openapi.yaml` y visualizable con `api-docs` en `http://localhost:8081`
- web mínima implementada en `http://localhost:5173` con listado de runs desde `GET /api/runs`
- selección por defecto prioriza runs en estado `running` cuando existen
- filtro por estado en tabla de runs (`all`, `running`, `finished`) persistido en URL
- ordenación de runs por fecha de actualización (asc/desc)
- ordenación de runs persistida en URL
- contadores en dashboard para runs totales/running/finished
- acción rápida `Jump to running` para seleccionar el run activo más reciente
- acción `Clear selection` para limpiar run seleccionado y ocultar detalle
- detalle de run en web implementado al seleccionar fila (`GET /api/runs/:runId`)
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
- filas de issues muestran identificador de PHPStan cuando existe
- filtro local de texto en panel de issues
- filtro de issues persistido en URL
- filtro de presencia de identificador en panel de issues
- preview de source en web para issue seleccionado (`GET /api/runs/:runId/source`)
- preview de source con numeración y resaltado de línea activa del issue
- navegador de archivos por run en web (`GET /api/runs/:runId/files`)
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
- acción `Copy link` para compartir el estado actual del dashboard

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
