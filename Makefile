SHELL := /usr/bin/env bash
.DEFAULT_GOAL := help

.PHONY: help ensure/env infra/image infra/deps infra/preview infra/up infra/destroy deploy/app deploy/all local/up local/reset local/down local/destroy

ROOT_DIR := $(CURDIR)
INFRA_DIR := $(ROOT_DIR)/infra
DEPLOY_SCRIPT := $(ROOT_DIR)/scripts/deploy-server.sh

define INFRA_DOCKER_RUN
cd $(INFRA_DIR) && docker run --rm -i \
  --env-file .env \
  -v "$$PWD":/workspace \
  -v "$$HOME/.ssh":/root/.ssh:ro \
  -v iac_pulumi_home:/root/.pulumi \
  -w /workspace \
  iac-tooling
endef

help:
	@printf '%s\n' 'Available targets:'
	@printf '  %-16s %s\n' 'help' 'Show this help message'
	@printf '  %-16s %s\n' 'infra/image' 'Build the docker image used for Pulumi operations'
	@printf '  %-16s %s\n' 'infra/deps' 'Install infra dependencies inside the dockerized workflow'
	@printf '  %-16s %s\n' 'infra/preview' 'Run pulumi preview for the dev stack'
	@printf '  %-16s %s\n' 'infra/up' 'Run pulumi up for the dev stack'
	@printf '  %-16s %s\n' 'infra/destroy' 'Run pulumi destroy for the dev stack'
	@printf '  %-16s %s\n' 'local/up' 'Build and start the local Docker stack'
	@printf '  %-16s %s\n' 'local/reset' 'Recreate the local Docker stack from a clean stopped state'
	@printf '  %-16s %s\n' 'local/down' 'Stop and remove local project containers and networks'
	@printf '  %-16s %s\n' 'local/destroy' 'Remove local project containers, networks, volumes, and project-built images'
	@printf '  %-16s %s\n' 'deploy/app' 'Deploy the application to the provisioned server over SSH'
	@printf '  %-16s %s\n' 'deploy/all' 'Provision infra and then deploy the application'

ensure/env:
	@if [ ! -f .env ] && [ -f .env.example ]; then \
		cp .env.example .env; \
		printf '%s\n' 'Created .env from .env.example'; \
	fi

infra/image:
	docker build -t iac-tooling $(INFRA_DIR)

infra/deps: infra/image
	$(INFRA_DOCKER_RUN) npm ci

infra/preview: infra/deps
	$(INFRA_DOCKER_RUN) sh -lc 'pulumi login && pulumi stack select dev || pulumi stack init dev && pulumi preview'

infra/up: infra/deps
	$(INFRA_DOCKER_RUN) sh -lc 'pulumi login && pulumi stack select dev || pulumi stack init dev && pulumi up --yes'

infra/destroy: infra/deps
	$(INFRA_DOCKER_RUN) sh -lc 'pulumi login && pulumi stack select dev && pulumi destroy --yes'

local/up: ensure/env
	docker compose up --build -d

local/reset: ensure/env
	docker compose down --remove-orphans
	docker compose up --build -d

local/down:
	docker compose down --remove-orphans

local/destroy:
	docker compose down --remove-orphans --volumes --rmi local

deploy/app:
	bash $(DEPLOY_SCRIPT)

deploy/all: infra/up
	PHPSAGE_DEPLOY_WAIT_SECONDS=30 bash $(DEPLOY_SCRIPT)