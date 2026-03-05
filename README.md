# PHPSage

PHPSage es una plataforma para ejecutar análisis estático de proyectos PHP con una experiencia operativa moderna (CLI + API + UI), trazabilidad de ejecuciones y evolución progresiva hacia asistencia IA segura.

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

- Node.js 20+
- npm 10+

### Instalación

```bash
npm install
```

### Comandos disponibles actualmente

```bash
npm run build
npm run test
npm run clean
npm run audit:unused
npm run rag:reindex
npm run rag:reindex:wait
```

> Nota: algunos comandos de alto nivel de producto (CLI/API/UI/Docker e2e) se habilitarán a medida que avance la implementación de las apps.

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

---

Este README se mantiene de forma incremental y debe reflejar siempre el estado real del proyecto.
