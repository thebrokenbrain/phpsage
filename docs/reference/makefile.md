# Comandos Make

El `Makefile` de la raíz del proyecto proporciona los entrypoints operativos principales de PHPSage.

## Referencia de comandos

### Entorno local

| Comando | Descripción |
|---|---|
| `make local/up` | Construye y arranca el stack local de Docker. Crea `.env` desde `.env.example` si no existe. |
| `make local/reset` | Para el stack, lo elimina y lo vuelve a levantar desde cero (sin borrar volúmenes). |
| `make local/down` | Para y elimina los contenedores y redes del proyecto. |
| `make local/destroy` | Elimina contenedores, redes, volúmenes e imágenes construidas por Compose. |

### Infraestructura

| Comando | Descripción |
|---|---|
| `make infra/image` | Construye la imagen Docker `iac-tooling` usada para operaciones de Pulumi. |
| `make infra/deps` | Instala las dependencias de `infra/` dentro del contenedor. |
| `make infra/preview` | Ejecuta `pulumi preview` para el stack `dev`. |
| `make infra/up` | Ejecuta `pulumi up` para provisionar la infraestructura. |
| `make infra/destroy` | Ejecuta `pulumi destroy` para eliminar la infraestructura. |

### Despliegue

| Comando | Descripción |
|---|---|
| `make deploy/app` | Despliega la aplicación en el servidor provisionado por SSH. |
| `make deploy/all` | Provisiona infraestructura (`infra/up`) y luego despliega la aplicación. Incluye 30 segundos de espera entre fases. |

### Documentación

| Comando | Descripción |
|---|---|
| `make docs/serve` | Arranca MkDocs en modo desarrollo en `http://localhost:8000`. Usa Docker a través de `docker-compose.docs.yml`, separado del stack principal. |
| `make docs/build` | Genera el HTML estático de la documentación en el directorio `site/`. Usa Docker a través de `docker-compose.docs.yml`. |

### Ayuda

| Comando | Descripción |
|---|---|
| `make help` | Muestra la lista de todos los comandos disponibles. |
