# Estructura del monorepo

## Árbol del proyecto

```text
phpsage/
├── apps/
│   ├── cli/              # CLI de PHPSage
│   ├── server/           # API HTTP y servicios de IA
│   └── web/              # Interfaz React/Vite
├── packages/
│   └── shared/           # Contratos y utilidades arquitectónicas compartidas
├── infra/                # Infraestructura de despliegue/demo (Pulumi)
├── deploy/
│   └── traefik/          # Configuración de publicación remota
├── docs/                 # Documentación funcional, técnica y de desarrollo asistido por IA
│   ├── ia/               # Prompts, contratos y guías de trabajo asistido por IA
│   │   ├── AGENTS.md
│   │   ├── API.md
│   │   ├── DEPLOY.md
│   │   └── UX.md
│   └── ...
├── examples/
│   ├── php-sample/       # Proyecto PHP con errores intencionales
│   └── php-sample-ok/    # Proyecto PHP sin errores
├── scripts/              # Scripts de automatización y smoke tests
├── certificates/         # Certificados TLS (fuera de git)
├── data/                 # Datos en tiempo de ejecución
│   ├── runs/             # Persistencia de runs
│   └── ai/               # Datos de ingesta y almacenamiento IA
├── assets/               # Recursos estáticos del proyecto y de la documentación
├── .env.example          # Plantilla de configuración
├── AGENTS.md             # Guía operativa principal del proyecto
├── docker-compose.yml    # Stack local de desarrollo
├── docker-compose.docs.yml    # Stack aislado para MkDocs
├── docker-compose.server.yml  # Override para despliegue remoto
├── Dockerfile            # Imagen base de la aplicación
├── Makefile              # Entrypoints operativos
├── mkdocs.yml            # Configuración de la documentación
├── package.json          # Configuración raíz del monorepo
├── tsconfig.base.json    # Configuración TypeScript compartida
└── tsconfig.json         # Configuración TypeScript raíz
```

## Piezas principales de PHPSage

### `apps/cli/`

CLI de PHPSage. Desde aquí se lanzan análisis de PHPStan, se levanta la aplicación y se ejecuta la ingesta de documentación para RAG.

- Punto de entrada: `src/index.ts`
- Comandos: `phpsage app`, `phpsage phpstan analyse <path>`, `phpsage rag ingest`

### `apps/server/`

API HTTP en Node.js que gestiona el ciclo de vida de los runs y la integración con IA. Sigue Clean Architecture:

- `src/domain/`: modelo `Run`
- `src/application/`: servicios de IA (explain, suggest-fix, ingest, RAG context), servicio de runs
- `src/infrastructure/`: adaptadores para filesystem, Ollama, OpenAI, Qdrant, patch guard
- `src/interfaces/`: servidor HTTP
- `src/ports/`: interfaces/puertos que definen contratos de los adaptadores

### `apps/web/`

Interfaz web construida con React y Vite. Incluye:

- Tres vistas principales: Dashboard, Insights, Issue
- Componentes: panel de IA, visor de código, barra de herramientas, panel lateral
- Hooks personalizados para la lógica de navegación, estado y comunicación con la API
- Estilos CSS modulares

Además, genera su propio bundle estático y mantiene configuración específica de Vite en `vite.config.ts`.

### `packages/shared/`

Paquete compartido que forma parte de la arquitectura interna del sistema. Centraliza piezas de diseño comunes para evitar acoplamiento entre CLI, servidor y web:

- Tipos y contratos serializables comunes entre CLI, servidor y web
- Parser de la salida de PHPStan (`phpstan-parser.ts`)

## Documentación y trazabilidad

### `docs/`

La documentación está organizada por áreas:

- `project-overview/`, `getting-started/`, `architecture/`, `api/`, `deployment/`, `reference/`, `ux/`: documentación funcional y técnica del producto
- `phpstan/`: corpus documental usado por el sistema RAG
- `ia/`: artefactos de desarrollo asistido por IA, incluyendo `AGENTS.md`, `API.md`, `DEPLOY.md` y `UX.md` como documentación de trabajo y trazabilidad del proceso

La navegación y publicación de esta documentación se define en `mkdocs.yml`.

### `AGENTS.md`

Documento raíz con las reglas operativas que guiaron el desarrollo del proyecto. Su contenido también se expone en `docs/ia/AGENTS.md` como parte de la trazabilidad documental del proceso.

## Soporte de despliegue y operaciones

### `infra/`

Infraestructura como código con Pulumi y TypeScript usada para publicar la demo y preparar el entorno remoto. No forma parte del núcleo funcional de PHPSage. Provisiona:

- Servidor en Hetzner Cloud
- Firewall y SSH keys
- DNS en Cloudflare
- Protección Zero Trust / Access

El detalle operativo de esta parte está en [deployment/infrastructure.md](../deployment/infrastructure.md).

### `deploy/traefik/`

Configuración de Traefik para el despliegue remoto. Define las rutas, middlewares y balanceadores de carga para exponer la web, la API y Swagger detrás de HTTPS.

### `examples/`

Proyectos PHP de ejemplo para validar el funcionamiento del sistema:

- `php-sample/`: proyecto PHP con arquitectura hexagonal y errores intencionales. Incluye entidades, servicios, controladores, puertos e implementaciones.
- `php-sample-ok/`: proyecto PHP mínimo sin errores.

### `scripts/`

Scripts de automatización:

- `phpsage.sh`: script principal de PHPSage
- `phpstan.sh`: ejecutor de PHPStan
- `deploy-server.sh`: despliegue del servidor por SSH
- `mkdocs_serve.py`: soporte histórico para el servido de documentación
- `reindex-rag.sh`: reindexado del corpus RAG
- `smoke-no-ai.sh`, `smoke-ollama.sh`, `smoke-openai.sh`: smoke tests por proveedor

### `data/`

Directorio de datos en tiempo de ejecución (no versionado en git):

- `data/runs/`: persistencia de runs y resultados de análisis
- `data/ai/`: datos de ingesta y almacenamiento IA
