# Guía de despliegue

Esta guía cubre el despliegue de PHPSage en un servidor remoto. El flujo está separado en dos fases: provisionar la infraestructura con Pulumi y desplegar la aplicación sobre el servidor resultante.

!!! note "Fase actual"
    El despliegue remoto de PHPSage está orientado a dejar una versión de desarrollo accesible para revisión externa. No es un despliegue de producción completo. GitHub Actions está previsto para una fase posterior.

## Requisitos para despliegue remoto

- `infra/.env` configurado con credenciales de Pulumi, Hetzner y Cloudflare
- `.env` de la aplicación configurado en la raíz del proyecto
- Acceso SSH válido al servidor
- Certificados TLS si se usa Cloudflare Full (strict)

## Flujo automatizado

Desde la raíz del repositorio, el Makefile ofrece dos entrypoints principales:

```bash
# Solo desplegar la aplicación (infraestructura ya provisionada)
make deploy/app

# Provisionar infraestructura + desplegar la aplicación
make deploy/all
```

### Qué hace `make deploy/app`

1. Verifica que la imagen `iac-tooling` existe (la construye si es necesario).
2. Obtiene la IP del servidor desde el output del stack de Pulumi.
3. Conecta por SSH al servidor.
4. Descarga o actualiza el código desde el repositorio Git en `/opt/phpsage`.
5. Copia el `.env` local al servidor.
6. Copia los certificados TLS referenciados en `.env` si las variables están definidas.
7. Ejecuta `docker compose -f docker-compose.yml -f docker-compose.server.yml up --build -d`.

### Variables de override para el despliegue

| Variable | Descripción | Valor por defecto |
|---|---|---|
| `PHPSAGE_ENV_FILE` | Ruta al archivo `.env` de la aplicación | `.env` |
| `PHPSAGE_INFRA_ENV_FILE` | Ruta al archivo `.env` de infraestructura | `infra/.env` |
| `PHPSAGE_DEPLOY_SOURCE` | Fuente del código | `git` (o `local` para árbol local) |
| `PHPSAGE_DEPLOY_HOST` | IP o hostname del servidor | Obtenida de Pulumi |
| `PHPSAGE_DEPLOY_USER` | Usuario SSH | `root` |
| `PHPSAGE_DEPLOY_PORT` | Puerto SSH | `22` |
| `PHPSAGE_DEPLOY_PATH` | Ruta en el servidor | `/opt/phpsage` |
| `PHPSAGE_DEPLOY_BRANCH` | Rama a desplegar | `main` |
| `PHPSAGE_DEPLOY_REMOTE` | Remote de Git | `origin` |
| `PHPSAGE_DEPLOY_WAIT_SECONDS` | Espera tras provisionar infra | `0` (`30` en `deploy/all`) |

Ejemplo:

```bash
PHPSAGE_DEPLOY_USER=root make deploy/app
```

Para desplegar cambios locales no pusheados temporalmente:

```bash
PHPSAGE_DEPLOY_SOURCE=local make deploy/app
```

## Flujo manual paso a paso

### 1. Provisionar infraestructura

Ver [Infraestructura (Pulumi)](infrastructure.md) para el detalle completo.

```bash
make infra/up
```

### 2. Conectar al servidor

```bash
ssh root@<SERVER_IP>
```

### 3. Preparar el código

```bash
cd /opt
git clone https://github.com/thebrokenbrain/phpsage.git
cd /opt/phpsage
```

Si ya existe:

```bash
cd /opt/phpsage
git pull origin main
```

### 4. Crear el `.env` de la aplicación

```bash
cd /opt/phpsage
cp .env.example .env
# Editar .env con los valores reales
```

Como mínimo para el entorno público:

```bash
PHPSAGE_PUBLIC_HOST=phpsage.example.com
PHPSAGE_TLS_CERT_PATH=./certificates/cloudflare-origin.crt
PHPSAGE_TLS_KEY_PATH=./certificates/cloudflare-origin.key
```

### 5. Levantar PHPSage

```bash
cd /opt/phpsage
docker compose -f docker-compose.yml -f docker-compose.server.yml up --build -d
```

### 6. Verificar

```bash
docker compose ps
curl http://127.0.0.1:8080/healthz
curl http://127.0.0.1:8080/api/ai/health
```

Verificación a través de Traefik:

```bash
curl -k -I https://127.0.0.1/
curl -k https://127.0.0.1/healthz
curl -k https://127.0.0.1/api/ai/health
curl -k -I https://127.0.0.1/docs/
```

## Estrategia de Compose

PHPSage usa dos archivos de Docker Compose:

- **`docker-compose.yml`**: stack local de desarrollo. Expone web en `5173`, API en `8080`, Swagger en `8081`.
- **`docker-compose.server.yml`**: override para el servidor remoto. Añade Traefik y expone todo por `80` (redirige a `443`) y `443` (HTTPS).

Esta separación permite que el flujo local no se vea afectado por la configuración del servidor.

### Enrutamiento en remoto (Traefik)

En el servidor, Traefik actúa como proxy inverso con rutas fijas definidas en `deploy/traefik/dynamic.yml`:

| Ruta | Destino interno |
|---|---|
| `/` | Web UI (`5173`) |
| `/api`, `/healthz` | Server API (`8080`) |
| `/docs` | Swagger UI (`8081`) |

Traefik termina TLS en `443` con un certificado de origen de Cloudflare, lo que permite usar el modo Cloudflare Full (strict).

## Certificados TLS

Para HTTPS con Cloudflare Full (strict), se necesita un certificado de origen:

1. Generar un Cloudflare Origin Certificate desde el panel de Cloudflare.
2. Guardar los archivos en el directorio `certificates/`:

```bash
mkdir -p certificates
chmod 700 certificates
# Pegar el certificado y la clave en los archivos
chmod 644 certificates/cloudflare-origin.crt
chmod 600 certificates/cloudflare-origin.key
```

3. Configurar las rutas en `.env`:

```bash
PHPSAGE_TLS_CERT_PATH=./certificates/cloudflare-origin.crt
PHPSAGE_TLS_KEY_PATH=./certificates/cloudflare-origin.key
```

!!! warning "Fuera de Git"
    El directorio `certificates/` debe mantenerse fuera de control de versiones. El `.gitignore` ya lo excluye.

## Actualización manual

Para actualizar la aplicación desplegada tras un push a `main`:

```bash
ssh root@<SERVER_IP>
cd /opt/phpsage
git pull origin main
docker compose -f docker-compose.yml -f docker-compose.server.yml up --build -d
```

## Acceso externo

El entorno actual está accesible en:

- **URL**: `https://phpsage.nopingnogain.com`
- **Puertos**: `80` (redirige a `443`), `443` (HTTPS)
- **Acceso**: protegido con Cloudflare Zero Trust (OTP por correo)
