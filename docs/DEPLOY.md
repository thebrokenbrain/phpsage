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

That file should:

- add Traefik
- expose only `80` and `443` on the host
- route `/` to the web service running internally on `5173`
- route `/api` and `/healthz` to the server running internally on `8080`
- optionally route `/docs` to Swagger
- avoid exposing `5173`, `8080`, and `8081` directly on the public interface

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

Operational rule:

- `infra/.env` is for running Pulumi
- `/opt/phpsage/.env` is for running PHPSage

## Recommended Manual Flow

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

## Manual Application Update

When you push changes to `main`, the manual deployment flow will be:

```bash
ssh root@SERVER_IP
cd /opt/phpsage
git pull origin main
docker compose -f docker-compose.yml -f docker-compose.server.yml up --build -d
```

## External Access In This Phase

In this dev phase, the decision is to expose the application externally through Traefik on standard ports:

- `80` for HTTP
- `443` for HTTPS / Cloudflare / Zero Trust

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
4. do not introduce GHCR yet
5. do not introduce GitHub Actions yet

## Can We Start Working?

Yes. The current decisions are coherent enough to start implementation.

At this point, the next concrete work item is clear:

1. create `docker-compose.server.yml`
2. add Traefik routing for web, API, and docs
3. keep `docker-compose.yml` unchanged for local development
4. deploy manually on the server and validate domain access through `80/443`

## Later Phase

Once the manual flow is stable, the next step will be to automate it with GitHub Actions over SSH to the server.

That workflow should not change the deployment model. It should only automate it.

## Checklist For This Phase

- infrastructure provisioned with Pulumi
- SSH access working
- repository cloned into `/opt/phpsage`
- real `.env` created on the server
- `docker compose -f docker-compose.yml -f docker-compose.server.yml up --build -d` working
- health checks passing inside the server
- external access validated through `80/443`
- local development still working on `5173`, `8080`, and `8081`