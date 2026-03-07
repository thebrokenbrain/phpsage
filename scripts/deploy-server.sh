#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
INFRA_DIR="$ROOT_DIR/infra"
APP_ENV_FILE="${PHPSAGE_ENV_FILE:-$ROOT_DIR/.env}"
INFRA_ENV_FILE="${PHPSAGE_INFRA_ENV_FILE:-$INFRA_DIR/.env}"
DEPLOY_PATH="${PHPSAGE_DEPLOY_PATH:-/opt/phpsage}"
DEPLOY_BRANCH="${PHPSAGE_DEPLOY_BRANCH:-main}"
DEPLOY_USER="${PHPSAGE_DEPLOY_USER:-root}"
DEPLOY_PORT="${PHPSAGE_DEPLOY_PORT:-22}"
DEPLOY_HOST="${PHPSAGE_DEPLOY_HOST:-}"
DEPLOY_REMOTE="${PHPSAGE_DEPLOY_REMOTE:-$(git -C "$ROOT_DIR" remote get-url origin)}"

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

require_file() {
  if [[ ! -f "$1" ]]; then
    echo "Missing required file: $1" >&2
    exit 1
  fi
}

read_env_value() {
  local env_file="$1"
  local key="$2"
  awk -F= -v key="$key" '$1 == key { sub(/^[^=]*=/, ""); print $0 }' "$env_file" | tail -n 1
}

resolve_local_path() {
  local raw_path="$1"

  case "$raw_path" in
    /*) printf '%s\n' "$raw_path" ;;
    ./*) printf '%s/%s\n' "$ROOT_DIR" "${raw_path#./}" ;;
    *) printf '%s/%s\n' "$ROOT_DIR" "$raw_path" ;;
  esac
}

resolve_remote_path() {
  local raw_path="$1"

  case "$raw_path" in
    /*) printf '%s\n' "$raw_path" ;;
    ./*) printf '%s/%s\n' "$DEPLOY_PATH" "${raw_path#./}" ;;
    *) printf '%s/%s\n' "$DEPLOY_PATH" "$raw_path" ;;
  esac
}

normalize_remote_url() {
  local remote_url="$1"

  if [[ "$remote_url" =~ ^git@github.com:(.+)$ ]]; then
    printf 'https://github.com/%s\n' "${BASH_REMATCH[1]}"
    return 0
  fi

  printf '%s\n' "$remote_url"
}

ssh_target() {
  printf '%s@%s\n' "$DEPLOY_USER" "$DEPLOY_HOST"
}

ssh_cmd() {
  ssh -p "$DEPLOY_PORT" -o StrictHostKeyChecking=accept-new "$(ssh_target)" "$@"
}

scp_file() {
  local source_path="$1"
  local target_path="$2"
  scp -P "$DEPLOY_PORT" "$source_path" "$(ssh_target):$target_path"
}

ensure_iac_image() {
  if ! docker image inspect iac-tooling >/dev/null 2>&1; then
    docker build -t iac-tooling "$INFRA_DIR"
  fi
}

ensure_infra_dependencies() {
  if [[ ! -d "$INFRA_DIR/node_modules/@pulumi" ]]; then
    docker run --rm -i \
      --env-file "$INFRA_ENV_FILE" \
      -v "$INFRA_DIR":/workspace \
      -v "$HOME/.ssh":/root/.ssh:ro \
      -v iac_pulumi_home:/root/.pulumi \
      -w /workspace \
      iac-tooling npm ci
  fi
}

pulumi_stack_output() {
  local output_name="$1"
  docker run --rm -i \
    --env-file "$INFRA_ENV_FILE" \
    -v "$INFRA_DIR":/workspace \
    -v "$HOME/.ssh":/root/.ssh:ro \
    -v iac_pulumi_home:/root/.pulumi \
    -w /workspace \
    iac-tooling sh -lc "pulumi login && pulumi stack select dev && pulumi stack output $output_name"
}

require_command docker
require_command git
require_command ssh
require_command scp

require_file "$APP_ENV_FILE"
require_file "$INFRA_ENV_FILE"

ensure_iac_image
ensure_infra_dependencies

if [[ -z "$DEPLOY_HOST" ]]; then
  DEPLOY_HOST="$(pulumi_stack_output publicIpv4 | tr -d '\r')"
fi

if [[ -z "$DEPLOY_HOST" ]]; then
  echo "Unable to determine deployment host from Pulumi output publicIpv4" >&2
  exit 1
fi

TLS_CERT_RAW="$(read_env_value "$APP_ENV_FILE" PHPSAGE_TLS_CERT_PATH)"
TLS_KEY_RAW="$(read_env_value "$APP_ENV_FILE" PHPSAGE_TLS_KEY_PATH)"

if [[ -n "$TLS_CERT_RAW" && -n "$TLS_KEY_RAW" ]]; then
  TLS_CERT_LOCAL="$(resolve_local_path "$TLS_CERT_RAW")"
  TLS_KEY_LOCAL="$(resolve_local_path "$TLS_KEY_RAW")"
  TLS_CERT_REMOTE="$(resolve_remote_path "$TLS_CERT_RAW")"
  TLS_KEY_REMOTE="$(resolve_remote_path "$TLS_KEY_RAW")"

  require_file "$TLS_CERT_LOCAL"
  require_file "$TLS_KEY_LOCAL"
fi

DEPLOY_REMOTE="$(normalize_remote_url "$DEPLOY_REMOTE")"

echo "Deploy host: $DEPLOY_HOST"
echo "Deploy path: $DEPLOY_PATH"

ssh_cmd "mkdir -p '$DEPLOY_PATH'"

ssh_cmd "if [ ! -d '$DEPLOY_PATH/.git' ]; then git clone '$DEPLOY_REMOTE' '$DEPLOY_PATH'; fi"
ssh_cmd "cd '$DEPLOY_PATH' && git fetch --all --prune && git checkout '$DEPLOY_BRANCH' && git pull --ff-only origin '$DEPLOY_BRANCH'"

scp_file "$APP_ENV_FILE" "$DEPLOY_PATH/.env"

if [[ -n "${TLS_CERT_RAW:-}" && -n "${TLS_KEY_RAW:-}" ]]; then
  ssh_cmd "mkdir -p '$(dirname "$TLS_CERT_REMOTE")'"
  scp_file "$TLS_CERT_LOCAL" "$TLS_CERT_REMOTE"
  scp_file "$TLS_KEY_LOCAL" "$TLS_KEY_REMOTE"
  ssh_cmd "chmod 644 '$TLS_CERT_REMOTE' && chmod 600 '$TLS_KEY_REMOTE'"
fi

ssh_cmd "cd '$DEPLOY_PATH' && docker compose -f docker-compose.yml -f docker-compose.server.yml up --build -d"

echo "Deployment finished on $(ssh_target)"