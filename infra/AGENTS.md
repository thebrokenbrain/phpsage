# AGENTS.md

## Project
Name: phpsage  
Type: Infrastructure as Code (IaC)  
Scope: Provision infrastructure only. The PHPSage application must not be deployed.

---

## 1. Purpose

This repository manages PHPSage infrastructure using Pulumi and TypeScript.

Current goal:

1. Provision infrastructure resources.
2. Keep setup simple, secure, and reproducible.
3. Leave the server ready for future deployment steps.

The PHPSage application runtime is out of scope.

---

## 2. Current scope

### In scope
- Infrastructure provisioning with Pulumi.
- Stack management in Pulumi Cloud.
- Hetzner Cloud server provisioning.
- Cloudflare DNS configuration.
- Basic server preparation for future deployment.
- SSH access via public key.

### Out of scope
- Deploying the PHPSage application.
- CI/CD pipelines.
- Kubernetes and autoscaling.
- Full production platform concerns.

---

## 3. Naming rules

- Pulumi project name: `phpsage`.
- Pulumi stack name: `dev`.
- The working stack must be `dev` only.

The repository must assume a single environment during this phase.

---

## 4. Configuration policy

Configuration must come from environment variables loaded from `.env`.

Required minimum variables:

- `PULUMI_ACCESS_TOKEN`
- `PULUMI_STACK=dev`

Provider-specific variables may include:

- `HCLOUD_TOKEN`
- `HCLOUD_SERVER_TYPE`
- `HCLOUD_LOCATION`
- `HCLOUD_IMAGE`
- `HCLOUD_SERVER_NAME`
- `HCLOUD_SSH_PUBLIC_KEY_PATH`
- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ZONE_ID`
- `CLOUDFLARE_DOMAIN`
- `CLOUDFLARE_SUBDOMAIN`
- `ENABLE_CLOUDFLARE_PROXY`
- `ENABLE_ZERO_TRUST`

Sensitive values must never be committed.

`.env` must be excluded from version control.

---

## 5. Deployment directory policy

Only one deployment directory is required at this phase:

- `/opt/phpsage`

No additional deployment subdirectories are mandatory right now.

Future phases may extend this directory structure if required.

---

## 6. Security baseline

- SSH must use public key authentication.
- Password authentication must stay disabled.
- Minimal inbound exposure policy: allow only ports `22`, `80`, `443`.
- Do not export secrets in Pulumi outputs.

SSH keys must be supplied by the user via configuration.

Example:

HCLOUD_SSH_PUBLIC_KEY_PATH=~/.ssh/id_rsa.pub

---

## 7. Working conventions

- Use TypeScript for infrastructure code.
- Keep modules small and focused.
- Prefer explicit types.
- Avoid hardcoded secrets.
- Keep scripts idempotent when possible.
- Shell scripts must use `set -euo pipefail`.

Infrastructure must prioritize:

- simplicity
- security
- reproducibility
- maintainability

Avoid overengineering.

---

## 8. Infrastructure components

The infrastructure must support the following components.

### Hetzner Cloud

Provision a single virtual machine with:

- public IPv4
- optional IPv6
- registered SSH key
- minimal firewall configuration

### Firewall policy

Inbound traffic allowed only on:

22 → SSH  
80 → HTTP  
443 → HTTPS  

All other inbound ports must be blocked.

Outbound traffic may remain unrestricted.

---

## 9. Cloudflare integration

The infrastructure may configure DNS records using Cloudflare.

Requirements:

- the domain already exists in the user's Cloudflare account
- create an `A` record pointing to the Hetzner server IP
- support configurable subdomain

Example:

phpsage.example.com

Proxying through Cloudflare should be configurable.

Zero Trust configuration may be added optionally but must remain isolated and configurable.

---

## 10. Server bootstrap

After provisioning the Hetzner server, the system must prepare the machine.

Minimum packages:

- docker
- docker-compose-plugin
- git
- curl
- wget
- unzip
- jq
- ca-certificates
- vim or nano
- htop

Optional tools may include:

- fail2ban
- tree

The bootstrap process must ensure:

- Docker is installed and running
- Docker Compose plugin is available
- `/opt/phpsage` directory exists

No application deployment must occur.

---

## 11. SSH access

SSH access must work immediately after provisioning.

Requirements:

- SSH public key registered in Hetzner
- server created with that key attached
- no password authentication

Connection example:

ssh -i ~/.ssh/id_rsa user@SERVER_IP

Pulumi outputs should include the public server IP.

---

## 12. Infrastructure outputs

Useful outputs may include:

- server name
- public IPv4
- public IPv6 (if enabled)
- server domain
- SSH connection hint

Secrets must never be exported.

---

## 13. Project structure recommendation

Example structure:

infra/
  AGENTS.md
  README.md
  .env.example
  Pulumi.yaml
  Pulumi.dev.yaml
  package.json
  tsconfig.json
  src/
    index.ts
    config.ts
    hetzner/
      server.ts
      firewall.ts
      ssh.ts
    cloudflare/
      dns.ts
      zerotrust.ts
    provision/
      bootstrap.ts
      cloudinit.ts

Modules must remain small and focused.

---

## 14. Definition of done (current phase)

The phase is complete when:

- infrastructure provisions successfully in stack `dev`
- stack and project naming remain `phpsage/dev`
- a Hetzner server is created
- Cloudflare DNS resolves to the server
- secure SSH access is available
- only required inbound ports are exposed (`22`, `80`, `443`)
- `/opt/phpsage` exists on target server
- Docker and Docker Compose are installed
- PHPSage application is not deployed

Future phases may expand the infrastructure once the base environment is stable.