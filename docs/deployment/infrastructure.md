# Infraestructura (Pulumi)

La infraestructura de PHPSage se gestiona con [Pulumi](https://www.pulumi.com/) y TypeScript, desde el directorio `infra/`.

## Qué provisiona

| Recurso | Proveedor | Descripción |
|---|---|---|
| Servidor | Hetzner Cloud | Servidor virtual para ejecutar PHPSage |
| Firewall | Hetzner Cloud | Reglas de acceso públicas: `22`, `80`, `443` |
| SSH Key | Hetzner Cloud | Registro de clave pública para acceso SSH |
| DNS | Cloudflare | Registro DNS apuntando al servidor |
| Zero Trust | Cloudflare | Protección de acceso por email (opcional) |
| Bootstrap | cloud-init | Directorio `/opt/phpsage` y configuración base |

Los puertos `5173`, `8080` y `8081` pertenecen a servicios internos del stack de aplicación y no forman parte de la apertura pública del firewall gestionado por Pulumi.

!!! info "Separación de responsabilidades"
    Pulumi solo gestiona la infraestructura. No despliega la aplicación. El despliegue de PHPSage se hace por separado (ver [Guía de despliegue](index.md)).

## Requisitos

- Docker Desktop
- Cuenta en Pulumi Cloud
- Cuenta en Hetzner Cloud
- Cuenta en Cloudflare
- Clave SSH pública disponible (por ejemplo, `~/.ssh/id_ed25519.pub`)

## Configuración

Crear el archivo de entorno:

```bash
cd infra
cp .env.example .env
```

Variables requeridas:

| Variable | Descripción |
|---|---|
| `PULUMI_ACCESS_TOKEN` | Token de acceso a Pulumi Cloud |
| `PULUMI_STACK` | Stack a usar (`dev`) |
| `HCLOUD_TOKEN` | Token de API de Hetzner Cloud |
| `HCLOUD_SSH_PUBLIC_KEY_PATH` | Ruta a la clave SSH pública |
| `CLOUDFLARE_API_TOKEN` | Token de API de Cloudflare |
| `CLOUDFLARE_ZONE_ID` | ID de la zona DNS |
| `CLOUDFLARE_ACCOUNT_ID` | ID de la cuenta de Cloudflare |
| `CLOUDFLARE_DOMAIN` | Dominio principal |
| `CLOUDFLARE_SUBDOMAIN` | Subdominio para PHPSage |

Para Zero Trust (opcional):

| Variable | Descripción |
|---|---|
| `ENABLE_ZERO_TRUST` | `true` para activar |
| `ZERO_TRUST_ALLOWED_EMAILS` | Lista de emails autorizados separados por coma |

Permisos mínimos de Cloudflare:

- `Zone DNS: Edit` sobre la zona configurada
- Permisos de Cloudflare Access a nivel de cuenta (si `ENABLE_ZERO_TRUST=true`)

## Enfoque de ejecución

El flujo recomendado es **docker-only**: no necesitas instalar Pulumi ni Node.js en tu máquina. Todo se ejecuta dentro de un contenedor.

## Comandos con Makefile

Desde la raíz del repositorio:

```bash
# Construir imagen de tooling + instalar dependencias
make infra/deps

# Ver preview del plan de infraestructura
make infra/preview

# Aplicar infraestructura
make infra/up

# Destruir infraestructura
make infra/destroy
```

## Comandos manuales paso a paso

Si prefieres control explícito, estos son los pasos desde el directorio `infra/`:

### 1. Construir la imagen de tooling

```bash
docker build -t iac-tooling .
```

### 2. Instalar dependencias

```bash
docker run --rm -i \
  --env-file .env \
  -v "$PWD":/workspace \
  -v "$HOME/.ssh":/root/.ssh:ro \
  -v iac_pulumi_home:/root/.pulumi \
  -w /workspace \
  iac-tooling npm install
```

### 3. Crear o seleccionar el stack

```bash
docker run --rm -i \
  --env-file .env \
  -v "$PWD":/workspace \
  -v "$HOME/.ssh":/root/.ssh:ro \
  -v iac_pulumi_home:/root/.pulumi \
  -w /workspace \
  iac-tooling sh -lc 'pulumi login && pulumi stack select dev || pulumi stack init dev'
```

### 4. Aplicar la infraestructura

```bash
docker run --rm -i \
  --env-file .env \
  -v "$PWD":/workspace \
  -v "$HOME/.ssh":/root/.ssh:ro \
  -v iac_pulumi_home:/root/.pulumi \
  -w /workspace \
  iac-tooling sh -lc 'pulumi login && pulumi stack select dev && pulumi up --yes'
```

## Verificaciones post-despliegue

Después de `pulumi up`, comprobar:

- Acceso SSH al servidor
- Que existe `/opt/phpsage`
- Que el dominio resuelve correctamente
- Que Zero Trust limita el acceso a los emails permitidos

## Troubleshooting

### Cloudflare devuelve `Authentication error` en DNS

Esto suele significar que el token de Cloudflare no tiene permisos efectivos sobre la zona. Verificar:

- Que `CLOUDFLARE_ZONE_ID` corresponde al dominio configurado
- Que el token incluye `Zone DNS: Edit`
- Que el token está limitado a la zona correcta
- Que el token incluye permisos de Access a nivel de cuenta (si se gestiona Zero Trust)

## Limpieza

Para dejar el proyecto completamente limpio en Pulumi Cloud:

```bash
# 1. Destruir recursos
make infra/destroy

# 2. Verificar que no quedan recursos remotos

# 3. Eliminar el stack (solo si ya se destruyeron los recursos)
docker run --rm -i \
  --env-file .env \
  -v "$PWD":/workspace \
  -v "$HOME/.ssh":/root/.ssh:ro \
  -v iac_pulumi_home:/root/.pulumi \
  -w /workspace \
  iac-tooling sh -lc 'pulumi login && pulumi stack rm dev --yes'
```
