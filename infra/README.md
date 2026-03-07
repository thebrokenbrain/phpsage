# PHPSage IaC

Infraestructura de PHPSage gestionada con Pulumi y TypeScript.

Estado actual:

- Proyecto Pulumi: `phpsage`
- Stack operativo: `dev`
- Infra base desplegable en Hetzner Cloud
- DNS en Cloudflare
- Zero Trust / Access en Cloudflare para restringir acceso por email

## Alcance

Esta IaC provisiona:

- servidor en Hetzner
- firewall para entorno dev (`22`, `80`, `443`, `5173`, `8080`, `8081`)
- registro SSH key en Hetzner
- bootstrap base del servidor
- directorio `/opt/phpsage`
- registro DNS en Cloudflare
- proteccion Zero Trust / Access para el dominio

No despliega la aplicacion PHPSage.

Nota de esta fase:

- para facilitar el acceso externo a la version dev de PHPSage, el firewall expone `5173`, `8080` y `8081`

## Requisitos

- Docker Desktop
- cuenta en Pulumi Cloud
- cuenta en Hetzner Cloud
- cuenta en Cloudflare
- clave SSH publica disponible en host, por ejemplo `~/.ssh/id_ed25519.pub`

## Configuracion

Crea el archivo de entorno:

```bash
cp .env.example .env
```

Completa en `.env` como minimo:

- `PULUMI_ACCESS_TOKEN`
- `PULUMI_STACK=dev`
- `HCLOUD_TOKEN`
- `HCLOUD_SSH_PUBLIC_KEY_PATH`
- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ZONE_ID`
- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_DOMAIN`
- `CLOUDFLARE_SUBDOMAIN`

Permisos minimos esperados en Cloudflare:

- `Zone DNS: Edit` sobre la zona configurada para poder crear y borrar el registro DNS
- permisos de Cloudflare Access a nivel cuenta si `ENABLE_ZERO_TRUST=true`

Para Zero Trust por email:

- `ENABLE_ZERO_TRUST=true`
- `ZERO_TRUST_ALLOWED_EMAILS=mouredev@gmail.com,jossemi@gmail.com,josemi.rodriguez@outlook.es`

## Enfoque de ejecucion

El flujo recomendado es `docker-only`.

Esto evita instalar dependencias de IaC en el host y mantiene el entorno reproducible.

Opcionalmente, puedes instalar `node`, `npm` y `pulumi` en tu maquina y ejecutar el proyecto de forma local, pero el flujo documentado aqui usa solo Docker.

## Despliegue de infraestructura

Ejecuta estos comandos en este orden desde el directorio `infra/`.

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

### 3. Compilar el proyecto

```bash
docker run --rm -i \
  --env-file .env \
  -v "$PWD":/workspace \
  -v "$HOME/.ssh":/root/.ssh:ro \
  -v iac_pulumi_home:/root/.pulumi \
  -w /workspace \
  iac-tooling npm run build
```

### 4. Crear o seleccionar el stack `dev`

```bash
docker run --rm -i \
  --env-file .env \
  -v "$PWD":/workspace \
  -v "$HOME/.ssh":/root/.ssh:ro \
  -v iac_pulumi_home:/root/.pulumi \
  -w /workspace \
  iac-tooling sh -lc 'pulumi login && pulumi stack select dev || pulumi stack init dev'
```

### 5. Revisar el plan

```bash
docker run --rm -i \
  --env-file .env \
  -v "$PWD":/workspace \
  -v "$HOME/.ssh":/root/.ssh:ro \
  -v iac_pulumi_home:/root/.pulumi \
  -w /workspace \
  iac-tooling sh -lc 'pulumi login && pulumi stack select dev && pulumi preview'
```

### 6. Aplicar la infraestructura

```bash
docker run --rm -i \
  --env-file .env \
  -v "$PWD":/workspace \
  -v "$HOME/.ssh":/root/.ssh:ro \
  -v iac_pulumi_home:/root/.pulumi \
  -w /workspace \
  iac-tooling sh -lc 'pulumi login && pulumi stack select dev && pulumi up --yes'
```

## Comandos utiles

### Ver preview

```bash
docker run --rm -i \
  --env-file .env \
  -v "$PWD":/workspace \
  -v "$HOME/.ssh":/root/.ssh:ro \
  -v iac_pulumi_home:/root/.pulumi \
  -w /workspace \
  iac-tooling sh -lc 'pulumi login && pulumi stack select dev && pulumi preview'
```

### Ver outputs del stack

```bash
docker run --rm -i \
  --env-file .env \
  -v "$PWD":/workspace \
  -v "$HOME/.ssh":/root/.ssh:ro \
  -v iac_pulumi_home:/root/.pulumi \
  -w /workspace \
  iac-tooling sh -lc 'pulumi login && pulumi stack select dev && pulumi stack output'
```

### Listar stacks del proyecto

```bash
docker run --rm -i \
  --env-file .env \
  -v "$PWD":/workspace \
  -v "$HOME/.ssh":/root/.ssh:ro \
  -v iac_pulumi_home:/root/.pulumi \
  -w /workspace \
  iac-tooling sh -lc 'pulumi login && pulumi stack ls'
```

### Destruir la infraestructura

```bash
docker run --rm -i \
  --env-file .env \
  -v "$PWD":/workspace \
  -v "$HOME/.ssh":/root/.ssh:ro \
  -v iac_pulumi_home:/root/.pulumi \
  -w /workspace \
  iac-tooling sh -lc 'pulumi login && pulumi stack select dev && pulumi destroy --yes'
```

Si el `destroy` falla al borrar el DNS de Cloudflare con `403 Authentication error`, el token suele ser valido pero sin alcance efectivo sobre la zona. Revisa que el token tenga `Zone DNS: Edit` para la zona correcta.

### Eliminar el stack de Pulumi Cloud

Haz esto solo si ya has destruido antes todos los recursos:

```bash
docker run --rm -i \
  --env-file .env \
  -v "$PWD":/workspace \
  -v "$HOME/.ssh":/root/.ssh:ro \
  -v iac_pulumi_home:/root/.pulumi \
  -w /workspace \
  iac-tooling sh -lc 'pulumi login && pulumi stack rm dev --yes'
```

## Ciclo de limpieza completo

Para dejar el proyecto completamente limpio en Pulumi Cloud:

1. Ejecuta `pulumi destroy --yes`
2. Verifica que no quedan recursos remotos
3. Ejecuta `pulumi stack rm dev --yes`

El paso 3 solo elimina el stack en Pulumi Cloud. No destruye recursos por si mismo.

## Troubleshooting

### Cloudflare devuelve `Authentication error` en DNS

Esto suele significar que el token sigue activo pero no tiene permisos efectivos sobre la zona usada por `CLOUDFLARE_ZONE_ID`.

Comprueba:

- que `CLOUDFLARE_ZONE_ID` corresponde al dominio configurado
- que el token incluye `Zone DNS: Edit`
- que el token esta limitado a la zona correcta si usas restricciones por recurso
- que el token incluye permisos de Access a nivel cuenta si tambien gestionas Zero Trust

## Verificaciones recomendadas

Despues de `up`, comprueba:

- acceso SSH al servidor
- que existe `/opt/phpsage`
- que el dominio resuelve correctamente
- que Zero Trust limita acceso a los emails permitidos
- que los puertos `5173`, `8080` y `8081` responden desde fuera si vas a exponer directamente la UI, la API y Swagger
