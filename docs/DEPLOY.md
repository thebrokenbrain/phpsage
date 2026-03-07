# PHPSage Deploy

Deployment guide for the dev version of PHPSage running on infrastructure provisioned with Pulumi.

## Current Goal

The goal in this phase is not a full production deployment.

The intent is to:

- bring up the infrastructure with Pulumi
- deploy PHPSage on the server using the same Docker approach that works locally
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
- run `docker compose up --build -d`

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

The server will run the same services currently defined in `docker-compose.yml`.

That means keeping the current dev-environment behavior for now:

- `phpsage-server`
- `phpsage-web`
- `phpsage-cli`
- `api-docs`
- `qdrant`
- `ollama`

This is not the final production approach, but it is the simplest way to expose a reviewable version of the project.

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

It is required because `docker compose` and `docker-compose.yml` use it to start the application services.

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
docker compose up --build -d
```

### 6. Verify The Services

```bash
docker compose ps
curl http://127.0.0.1:8080/healthz
curl http://127.0.0.1:8080/api/ai/health
```

## Manual Application Update

When you push changes to `main`, the manual deployment flow will be:

```bash
ssh root@SERVER_IP
cd /opt/phpsage
git pull origin main
docker compose up --build -d
```

## External Access In This Phase

In this dev phase, the decision is to open in the firewall the same ports already published by `docker-compose.yml`:

- `5173` for the UI
- `8080` for the API
- `8081` for Swagger

This simplifies external access for review, at the cost of a more relaxed security posture than the original baseline.

## Current Recommendation

For a dev version that is easily accessible to the professor, the best next iteration is:

1. keep manual application deployment outside Pulumi
2. open ports `5173`, `8080`, and `8081` in infrastructure
3. do not introduce GHCR yet
4. do not introduce GitHub Actions yet

## Later Phase

Once the manual flow is stable, the next step will be to automate it with GitHub Actions over SSH to the server.

That workflow should not change the deployment model. It should only automate it.

## Checklist For This Phase

- infrastructure provisioned with Pulumi
- SSH access working
- repository cloned into `/opt/phpsage`
- real `.env` created on the server
- `docker compose up --build -d` working
- health checks passing inside the server
- external access validated on `5173`, `8080`, and `8081`