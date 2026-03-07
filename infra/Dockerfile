FROM node:24-alpine

ARG PULUMI_VERSION=3.225.1

RUN apk add --no-cache curl ca-certificates bash \
  && curl -fsSL https://get.pulumi.com | sh -s -- --version ${PULUMI_VERSION} \
  && ln -s /root/.pulumi/bin/pulumi /usr/local/bin/pulumi

WORKDIR /workspace
