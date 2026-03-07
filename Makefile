SHELL := /usr/bin/env bash
.DEFAULT_GOAL := help

.PHONY: help infra/image infra/deps infra/preview infra/up infra/destroy deploy/app deploy/all

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
	@printf '  %-16s %s\n' 'deploy/app' 'Deploy the application to the provisioned server over SSH'
	@printf '  %-16s %s\n' 'deploy/all' 'Provision infra and then deploy the application'

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

deploy/app:
	bash $(DEPLOY_SCRIPT)

deploy/all: infra/up
	PHPSAGE_DEPLOY_WAIT_SECONDS=30 bash $(DEPLOY_SCRIPT)