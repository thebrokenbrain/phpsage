# PHPSage

PHPSage es una plataforma Docker-first para ejecutar análisis de PHPStan, persistir historial de runs y navegar resultados en una UI web en vivo, con soporte opcional de IA/RAG para explicar issues y sugerir fixes con guardarraíles.

## a) Descripción general del proyecto

PHPSage está orientado a un flujo end-to-end de análisis estático PHP:

- CLI para lanzar análisis y abrir la experiencia de aplicación.
- Server API para gestionar el ciclo de vida de runs (`start/log/finish`), consultar historial y exponer endpoints de IA.
- Web UI para explorar runs, logs, issues, archivos y código fuente.
- Capa IA/RAG opcional con proveedores OpenAI u Ollama, incluyendo sugerencias de patch seguras.

Comandos principales del CLI:

- `phpsage app`
- `phpsage phpstan analyse <path>`
- `phpsage rag ingest`

## b) Stack tecnológico utilizado

- Monorepo con npm workspaces.
- TypeScript en apps y paquete compartido.
- Node.js para CLI, server y tooling.
- React + Vite + TypeScript en frontend.
- Docker + Docker Compose para ejecución reproducible.
- Qdrant (opcional) y backend filesystem para RAG.
- Pulumi + TypeScript en `infra/` para infraestructura como código.

## c) Instalación y ejecución

### Programas necesarios

Para usar PHPSage en modo recomendado (Docker-first):

- Docker Desktop (incluye Docker Engine).
- Docker Compose v2 (`docker compose`).

Opcional para desarrollo local fuera de Docker:

- Node.js 22+ y npm.

### Pasos de instalación

1. Clonar el repositorio y entrar en la carpeta del proyecto.
2. Crear archivo de entorno a partir del ejemplo.

```bash
cp .env.example .env
```

Si prefieres ir directo al flujo Docker local, `make local/up` y `make local/reset` crean `.env` automáticamente a partir de `.env.example` cuando aún no existe.

Si también vas a desplegar infraestructura, crea además el archivo de entorno de `infra/`:

```bash
cp infra/.env.example infra/.env
```

### Configuración de `.env`

El archivo `.env` define proveedor de IA y parámetros de RAG. Valores importantes:

- `AI_PROVIDER=ollama|openai`
- `OLLAMA_BASE_URL`, `OLLAMA_MODEL`
- `OPENAI_BASE_URL`, `OPENAI_API_KEY`, `OPENAI_MODEL`
- `AI_RAG_BACKEND=filesystem|qdrant`
- `QDRANT_URL`, `QDRANT_COLLECTION`
- `AI_INGEST_DEFAULT_TARGET`, `AI_RAG_DIRECTORY`, `AI_RAG_TOP_K`

Notas:

- Docker Compose lee `.env` por defecto.
- Puedes usar otro archivo con `PHPSAGE_ENV_FILE=<ruta>`.

### Comandos precisos de ejecución

Levantar plataforma completa:

```bash
docker compose up --build -d
```

En local, `ollama` ya no bloquea el arranque del resto del stack mientras termina de descargar el modelo. Esto evita falsos fallos de `docker compose up` en máquinas donde la primera descarga tarda más de lo esperado.

Opcional (recomendado si vas a usar `AI_PROVIDER=ollama`): precargar el modelo localmente antes de arrancar todo.

```bash
docker compose up -d ollama
docker compose exec ollama ollama pull "${OLLAMA_MODEL:-llama3.2}"
docker compose exec ollama ollama list
```

Si estás usando `AI_PROVIDER=openai`, no necesitas esperar a que `ollama` termine esa precarga para levantar la UI y la API local.

El modelo queda persistido en el volumen Docker `phpsage_ollama-data`, por lo que no se descarga de nuevo en cada reinicio.

Servicios principales:

- UI: `http://localhost:5173`
- API: `http://localhost:8080`
- Swagger: `http://localhost:8081`

Notas sobre routing en desarrollo y despliegue:

- La Web UI usa mismo origen por defecto para `/api` y `/healthz`.
- En local con Docker, Vite proxya esas rutas hacia `phpsage-server:8080`.
- En desarrollo local fuera de Docker, el proxy por defecto apunta a `http://127.0.0.1:8080`.
- En servidor detrás de Traefik, la UI consume la API a través del mismo host público.

Verificaciones rápidas:

```bash
curl http://localhost:8080/healthz
curl http://localhost:8080/api/ai/health
```

Ejecutar un análisis desde contenedor CLI:

```bash
docker compose run --rm phpsage-cli phpsage phpstan analyse /workspace/examples/php-sample --docker --no-open
```

Persistencia de runs:

- El historial se guarda en `data/runs/` del host.
- Los archivos `*.json` de runs están ignorados por git (`.gitignore`).

Scripts útiles de smoke/reindex:

```bash
./scripts/smoke-no-ai.sh
./scripts/smoke-ollama.sh
./scripts/smoke-openai.sh
./scripts/reindex-rag.sh --wait
```

### Deploy automatizado al servidor

Para automatizar el flujo operador sin meter el despliegue de código dentro de Pulumi, el repositorio incluye un `Makefile` y un script de despliegue por SSH.

Comandos disponibles:

```bash
make local/up
make local/reset
make local/down
make local/destroy
make infra/preview
make infra/up
make infra/destroy
make deploy/app
make deploy/all
```

Resumen del flujo:

- `make local/up`: construye y levanta el stack Docker local para desarrollo o validación rápida.
- `make local/reset`: baja el stack local, limpia contenedores huérfanos y lo vuelve a levantar desde cero.
- `make local/down`: detiene y elimina los contenedores y redes del proyecto en local, sin borrar volúmenes ni imágenes.
- `make local/destroy`: elimina contenedores, redes, volúmenes del proyecto y las imágenes construidas localmente por Compose (`--rmi local`).
- `make infra/deps`: instala dependencias de `infra/` dentro del flujo dockerizado para que Pulumi pueda ejecutar el programa TypeScript montado desde el host.
- `make infra/up`: provisiona o actualiza la infraestructura con Pulumi usando el flujo `docker-only`.
- `make infra/destroy`: destruye los recursos provisionados del stack `dev` con Pulumi. No elimina el stack de Pulumi Cloud.
- `make deploy/app`: obtiene la IP pública desde Pulumi, conecta por SSH, sincroniza el código del repositorio público desde GitHub en `/opt/phpsage`, copia el `.env` local y los certificados referenciados desde ese `.env`, y levanta Docker Compose en el servidor. No añade espera previa por defecto.
- `make deploy/all`: ejecuta ambos pasos de forma secuencial, añade una espera inicial de 30 segundos y después deja que el script de despliegue espere activamente a que `cloud-init` termine en la máquina recién provisionada antes de continuar.

Separación recomendada:

- usa `local/*` para trabajar sólo contra Docker en tu máquina
- usa `deploy/*` para el host remoto provisionado por Pulumi

Precaución con `local/destroy`:

- borra también los volúmenes Docker del proyecto, incluido el estado local de Qdrant y Ollama
- si usas Ollama localmente, tendrás que volver a descargar el modelo después

Nota importante: usar Docker para Pulumi no elimina la necesidad de instalar dependencias del programa IaC. El binario `pulumi` vive dentro del contenedor, pero el código TypeScript de `infra/` se ejecuta desde el directorio montado del host, así que `node_modules` debe existir en `infra/`.

Requisitos para `make deploy/app`:

- `infra/.env` configurado
- `.env` local listo para copiar al servidor
- acceso SSH al host provisionado
- repositorio público accesible desde el servidor o `PHPSAGE_DEPLOY_SOURCE=local` si quieres forzar el árbol local actual
- certificados en `certificates/` si usas Cloudflare `Full (strict)`

Comportamiento de robustez del deploy:

- si el host remoto acaba de ser reprovisionado y mantiene la misma IP, el script detecta el cambio de huella SSH
- cuando `PHPSAGE_DEPLOY_HOST` es una IP literal, elimina automáticamente la entrada obsoleta de `known_hosts` y reintenta una vez
- además espera a que `cloud-init` termine antes de intentar resolver Docker Compose en el servidor

### Infraestructura como código

La infraestructura de PHPSage forma parte del monorepo en `infra/` y se gestiona con Pulumi en un flujo `docker-only`.

Desde ese directorio se provisionan:

- servidor Hetzner
- firewall base
- DNS en Cloudflare
- Zero Trust opcional

La guía operativa completa está en `infra/README.md`.

## d) Estructura del proyecto

```text
phpsage/
  apps/
    cli/
    server/
    web/
  infra/
  packages/
    shared/
  docs/
    phpstan/
  examples/
  assets/
    logo/
  data/
    runs/
  scripts/
  .env.example
  docker-compose.yml
  Dockerfile
  package.json
```

Descripción por directorio:

- `apps/cli`: interfaz de línea de comandos (`app`, `phpstan analyse`, `rag ingest`).
- `apps/server`: API HTTP y orquestación del ciclo de vida de runs + endpoints IA/RAG.
- `apps/web`: interfaz React/Vite con Dashboard, Insights e Issue navigation.
- `infra`: proyecto Pulumi para Hetzner, Cloudflare y bootstrap base del servidor.
- `packages/shared`: contratos/tipos compartidos y utilidades puras (por ejemplo parser de salida PHPStan).
- `docs`: documentación funcional y técnica (`API.md`, `UX.md`, `openapi.yaml`).
- `examples`: proyectos PHP de ejemplo para pruebas y smoke.
- `docs/phpstan`: corpus markdown para ingest y recuperación de contexto.
- `assets/logo`: recursos de marca.
- `data/runs`: persistencia local de runs en JSON.
- `scripts`: automatizaciones de smoke, reindex y wrappers de utilidad.

## e) Funcionalidades principales

### CLI

- `phpsage app`: arranca experiencia de aplicación (app-first).
- `phpsage phpstan analyse <path>` con:
  - sincronización de lifecycle (`start/log/finish`)
  - modo watch (`--watch`) y ajustes (`--watch-interval`, `--watch-debounce`, `--watch-max-cycles`, etc.)
  - timeout (`--timeout-ms`)
  - resumen JSON (`--json-summary`)
- `phpsage rag ingest` con:
  - ejecución y espera (`--wait`)
  - listado de jobs (`--list`)
  - filtros por estado (`--status`) y límite (`--limit`)

### API

- Salud:
  - `GET /healthz`
  - `GET /api/ai/health`
- Runs:
  - `GET /api/runs`
  - `GET /api/runs/:runId`
  - `DELETE /api/runs/:runId`
  - `POST /api/runs/start`
  - `POST /api/runs/:runId/log`
  - `POST /api/runs/:runId/finish`
  - `GET /api/runs/:runId/source?file=...`
  - `GET /api/runs/:runId/files`
- IA/RAG:
  - `POST /api/ai/ingest`
  - `GET /api/ai/ingest`
  - `GET /api/ai/ingest/latest`
  - `GET /api/ai/ingest/:jobId`
  - `POST /api/ai/explain`
  - `POST /api/ai/suggest-fix`

### Web UI

- `Dashboard` con control de ejecuciones y estado en vivo.
- `Insights` con KPIs y distribución de issues.
- `Issue` con navegación contextual de issue, archivo y línea.
- Side panel con runs, borrado de runs y árbol de ficheros.
- AI Assist para explain/suggest-fix sobre issue activo, con deduplicación defensiva de recomendaciones ya presentes en el texto principal.

## Referencias de documentación

- Contrato API (manual): `docs/API.md`
- Contrato OpenAPI: `docs/openapi.yaml`
- Contrato UX: `docs/UX.md`
- Infraestructura: `infra/README.md`
- Despliegue de la aplicacion: `docs/DEPLOY.md`
