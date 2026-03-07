# PHPSage Deploy

Deployment guide for the dev version of PHPSage running on infrastructure provisioned with Pulumi.

## Current Goal

The goal in this phase is not a full production deployment.

The intent is to:

- bring up the infrastructure with Pulumi
- deploy PHPSage on the server without breaking the local Docker workflow
- leave a dev version accessible for external review
- postpone GitHub Actions until the manual flow is stable

## Responsibility Split

### Pulumi

Pulumi only manages infrastructure in `infra/`:

- Hetzner server
- firewall
- Cloudflare DNS
- optional Zero Trust
- base server bootstrap
- `/opt/phpsage` directory

Pulumi should not be used to deploy the application on every change.

### Application

Application deployment happens inside the server:

- clone or update the repository in `/opt/phpsage`
- create the application `.env`
- run Docker Compose with a server-specific override file

The repository also includes an operator-friendly automation path:

- `make deploy/app` copies the local `.env` and referenced TLS files to the server, then runs Docker Compose remotely over SSH
- `make deploy/all` runs `pulumi up` first and then deploys the application

### GitHub Actions

GitHub Actions is deferred to a later phase.

Once the manual flow works well, the ideal automation will be:

- SSH into the server
- `git pull`
- `docker compose up --build -d`

## Assumed Current State

This guide assumes the infrastructure phase is already solved:

- `infra/` provisions the `dev` stack correctly
- Docker and Docker Compose are installed on the server
- `/opt/phpsage` exists
- DNS points to the server

## Deployment Decision For This Phase

The server will run the same application services currently defined in `docker-compose.yml`, but server-specific routing will live in a separate compose file.

That means keeping the current dev-environment services for now:

- `phpsage-server`
- `phpsage-web`
- `phpsage-cli`
- `api-docs`
- `qdrant`
- `ollama`

This is not the final production approach, but it is the simplest way to expose a reviewable version of the project.

The key decision is to keep environment-specific behavior split across compose files:

- `docker-compose.yml` stays focused on local development
- `docker-compose.server.yml` will contain server-only behavior

This avoids breaking local access on `5173` while still allowing clean external access on `80/443` in Hetzner.

## Compose Strategy

### Local

The base file remains the local development entrypoint:

- web exposed on `5173`
- API exposed on `8080`
- Swagger exposed on `8081`

Local usage remains:

```bash
docker compose up --build
```

### Server

The server will use a second compose file, expected to be named `docker-compose.server.yml`.

The current functional slices keep this file intentionally small.

Current slice scope:

- add Traefik
- expose `80` and `443` on the host
- redirect `80` to `443`
- route `/` to the web service running internally on `5173` through TLS
- route `/api` and `/healthz` to the server running internally on `8080` through TLS
- route `/docs` to Swagger running internally on `8080` in the `api-docs` container through TLS
- load a certificate and private key for Cloudflare Full (strict)

For reliability, Traefik is configured with a file provider and fixed routes instead of Docker label autodiscovery.

In the current slices, routing is path-based only so it can be validated locally without depending on host-rule interpolation.

The current implementation is suitable for Cloudflare `Full (strict)` because Traefik now terminates TLS on `443` with an origin certificate.

That file should eventually:

- add Traefik
- expose only `80` and `443` on the host
- redirect `80` to `443`
- route `/` to the web service running internally on `5173`
- route `/api` and `/healthz` to the server running internally on `8080`
- route `/docs` to Swagger
- terminate TLS with an origin certificate trusted by Cloudflare
- avoid exposing `5173`, `8080`, and `8081` directly on the public interface

In the current implementation, fixed routing lives in `deploy/traefik/dynamic.yml`.

Expected server command:

```bash
docker compose -f docker-compose.yml -f docker-compose.server.yml up --build -d
```

This keeps the local workflow unchanged while giving the server a proper public entrypoint through Traefik.

## Environment Variables

### `infra/.env`

The `infra/.env` file is only used for infrastructure.

It contains credentials and configuration for:

- Pulumi
- Hetzner
- Cloudflare

That file must not be copied to the server to run PHPSage.

### `/opt/phpsage/.env`

The PHPSage `.env` file must exist on the server.

It is required because `docker compose`, `docker-compose.yml`, and the future `docker-compose.server.yml` use it to start the application services.

`PHPSAGE_PUBLIC_HOST` remains useful for later host-based routing and Cloudflare-facing slices, but it is not required by the current file-provider rules.

For the TLS slice, the server `.env` must also define:

- `PHPSAGE_TLS_CERT_PATH`
- `PHPSAGE_TLS_KEY_PATH`

The `api-docs` service also receives `BASE_URL=/docs` from the server override so Swagger UI can be published cleanly behind Traefik under that path.

Operational rule:

- `infra/.env` is for running Pulumi
- `/opt/phpsage/.env` is for running PHPSage

### Cloudflare Origin Certificate

Because Cloudflare is configured in `Full (strict)`, the server must present a certificate on `443`.

The simplest setup for this phase is a Cloudflare Origin Certificate.

Recommended repository-local paths:

- `./certificates/cloudflare-origin.crt`
- `./certificates/cloudflare-origin.key`

This directory should stay outside git and can be prepared before the server exists.

Local preparation:

```bash
cd /path/to/phpsage
mkdir -p certificates
chmod 700 certificates
```

Then paste the certificate and private key obtained from Cloudflare into those files and restrict the key permissions:

```bash
chmod 600 certificates/cloudflare-origin.key
chmod 644 certificates/cloudflare-origin.crt
```

After that, set these values in `/opt/phpsage/.env` or your local `.env`:

```bash
PHPSAGE_TLS_CERT_PATH=./certificates/cloudflare-origin.crt
PHPSAGE_TLS_KEY_PATH=./certificates/cloudflare-origin.key
```

When the server exists, copy the same files into `/opt/phpsage/certificates/` and keep the same relative paths in `.env`.

## Recommended Manual Flow

## Automated Flow

If you want a single operator entrypoint, use the repository root `Makefile`.

Available commands:

```bash
make infra/deps
make infra/preview
make infra/up
make deploy/app
make deploy/all
```

What `make deploy/app` does:

1. ensures the local `iac-tooling` image exists
2. reads the target host from the Pulumi stack output `publicIpv4`
3. connects through SSH as `root` by default
4. clones or updates the repository in `/opt/phpsage`
5. copies the local `.env` to `/opt/phpsage/.env`
6. copies the TLS certificate and key referenced by `.env` when those variables are present
7. runs `docker compose -f docker-compose.yml -f docker-compose.server.yml up --build -d`

Why `make infra/deps` exists:

- the `iac-tooling` image provides the Pulumi CLI
- the Pulumi TypeScript program still runs from the mounted `infra/` directory on the host
- because of that, `infra/node_modules` must exist before `pulumi preview`, `pulumi up`, or `pulumi stack output`

If you run the raw `docker run ... pulumi up` command without installing dependencies first, Pulumi will fail with a message similar to `It looks like the Pulumi SDK has not been installed.`

Optional overrides for the automated flow:

- `PHPSAGE_ENV_FILE`
- `PHPSAGE_INFRA_ENV_FILE`
- `PHPSAGE_DEPLOY_HOST`
- `PHPSAGE_DEPLOY_USER`
- `PHPSAGE_DEPLOY_PORT`
- `PHPSAGE_DEPLOY_PATH`
- `PHPSAGE_DEPLOY_BRANCH`
- `PHPSAGE_DEPLOY_REMOTE`

Example:

```bash
PHPSAGE_DEPLOY_USER=root make deploy/app
```

The manual flow below remains valid if you want explicit control over each step.

### 1. Bring Up The Infrastructure

From `infra/`:

```bash
docker build -t iac-tooling .

docker run --rm -i \
  --env-file .env \
  -v "$PWD":/workspace \
  -v "$HOME/.ssh":/root/.ssh:ro \
  -v iac_pulumi_home:/root/.pulumi \
  -w /workspace \
  iac-tooling sh -lc 'pulumi login && pulumi stack select dev || pulumi stack init dev'

docker run --rm -i \
  --env-file .env \
  -v "$PWD":/workspace \
  -v "$HOME/.ssh":/root/.ssh:ro \
  -v iac_pulumi_home:/root/.pulumi \
  -w /workspace \
  iac-tooling sh -lc 'pulumi login && pulumi stack select dev && pulumi up --yes'
```

Then get the stack IP or domain:

```bash
docker run --rm -i \
  --env-file .env \
  -v "$PWD":/workspace \
  -v "$HOME/.ssh":/root/.ssh:ro \
  -v iac_pulumi_home:/root/.pulumi \
  -w /workspace \
  iac-tooling sh -lc 'pulumi login && pulumi stack select dev && pulumi stack output'
```

### 2. SSH Into The Server

Example:

```bash
ssh root@SERVER_IP
```

### 3. Prepare The Code On The Server

```bash
cd /opt
git clone https://github.com/thebrokenbrain/phpsage.git
cd /opt/phpsage
```

If the directory already exists:

```bash
cd /opt/phpsage
git pull origin main
```

### 4. Create The Application `.env`

```bash
cd /opt/phpsage
cp .env.example .env
```

Then fill in the real values required by the application for whichever AI/RAG mode you want to run.

At minimum for the public entrypoint, ensure these values are set:

```bash
PHPSAGE_PUBLIC_HOST=phpsage.example.com
PHPSAGE_TLS_CERT_PATH=./certificates/cloudflare-origin.crt
PHPSAGE_TLS_KEY_PATH=./certificates/cloudflare-origin.key
```

### 5. Start PHPSage With Docker Compose

```bash
cd /opt/phpsage
docker compose -f docker-compose.yml -f docker-compose.server.yml up --build -d
```

### 6. Verify The Services

```bash
docker compose ps
curl http://127.0.0.1:8080/healthz
curl http://127.0.0.1:8080/api/ai/health
```

Once Traefik is in place, also verify public access through the domain on `80/443` rather than through direct dev ports.

Current Traefik verification examples:

```bash
curl -k -I https://127.0.0.1/
curl -k https://127.0.0.1/healthz
curl -k https://127.0.0.1/api/ai/health
curl -k -I https://127.0.0.1/docs/
curl -I http://127.0.0.1/
```

## Manual Application Update

When you push changes to `main`, the manual deployment flow will be:

```bash
ssh root@SERVER_IP
cd /opt/phpsage
git pull origin main
docker compose -f docker-compose.yml -f docker-compose.server.yml up --build -d
```

## External Access In This Phase

In this dev phase, the decision is to expose the application externally through Traefik on standard ports.

For the current slices, `80` redirects to `443`, and the web UI, backend HTTP endpoints, and Swagger are served through HTTPS.

Current public entrypoint:

- `80` for HTTP to HTTPS redirection
- `443` for HTTPS

Internally, the application can continue using:

- `5173` for the web service
- `8080` for the API
- `8081` for Swagger

This keeps local behavior intact while avoiding direct public exposure of development ports.

## Current Recommendation

For a dev version that is easily accessible to the professor, the best next iteration is:

1. keep manual application deployment outside Pulumi
2. keep the firewall on `22`, `80`, and `443`
3. add Traefik through `docker-compose.server.yml`
4. validate HTTPS routing on `443`
5. validate the HTTP to HTTPS redirect on `80`
6. do not introduce GHCR yet
7. do not introduce GitHub Actions yet

## Can We Start Working?

Yes. The current decisions are coherent enough to start implementation.

At this point, the next concrete work item is clear:

1. create `docker-compose.server.yml`
2. add Traefik routing for the web service and backend HTTP endpoints
3. add Swagger routing on `/docs`
4. keep `docker-compose.yml` unchanged for local development
5. add origin TLS on `443` for Cloudflare `Full (strict)`
6. deploy manually on the server and validate domain access through `80/443`

## Later Phase

Once the manual flow is stable, the next step will be to automate it with GitHub Actions over SSH to the server.

That workflow should not change the deployment model. It should only automate it.

## Checklist For This Phase

- infrastructure provisioned with Pulumi
- SSH access working
- repository cloned into `/opt/phpsage`
- real `.env` created on the server
- `PHPSAGE_PUBLIC_HOST` defined in the server `.env`
- `docker compose -f docker-compose.yml -f docker-compose.server.yml up --build -d` working
- health checks passing inside the server
- external access validated through `443`
- HTTP to HTTPS redirect validated on `80`
- `/api` and `/healthz` validated through Traefik on `443`
- `/docs` validated through Traefik on `443`
- local development still working on `5173`, `8080`, and `8081`