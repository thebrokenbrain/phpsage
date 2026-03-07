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
DEPLOY_SOURCE="${PHPSAGE_DEPLOY_SOURCE:-git}"
DEPLOY_REMOTE="${PHPSAGE_DEPLOY_REMOTE:-$(git -C "$ROOT_DIR" remote get-url origin)}"
DEPLOY_WAIT_SECONDS="${PHPSAGE_DEPLOY_WAIT_SECONDS:-0}"
DEPLOY_CLOUD_INIT_TIMEOUT_SECONDS="${PHPSAGE_DEPLOY_CLOUD_INIT_TIMEOUT_SECONDS:-300}"

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

ssh_base_args() {
  printf '%s\n' "-p" "$DEPLOY_PORT" "-o" "StrictHostKeyChecking=accept-new"
}

check_ssh_host_key() {
  local output

  set +e
  output="$({ ssh $(ssh_base_args) "$(ssh_target)" true; } 2>&1)"
  local status=$?
  set -e

  if [[ $status -eq 0 ]]; then
    return 0
  fi

  if grep -q "REMOTE HOST IDENTIFICATION HAS CHANGED" <<<"$output"; then
    echo "SSH host key mismatch detected for $DEPLOY_HOST." >&2
    echo "This usually means the server was reprovisioned and your local known_hosts entry is stale." >&2
    echo "Review the new fingerprint, then refresh the entry with:" >&2
    echo "  ssh-keygen -R '$DEPLOY_HOST'" >&2
    echo "After that, run make deploy/app again." >&2
    exit 1
  fi

  echo "$output" >&2
  exit $status
}

ssh_cmd() {
  ssh $(ssh_base_args) "$(ssh_target)" "$@"
}

scp_file() {
  local source_path="$1"
  local target_path="$2"
  scp -P "$DEPLOY_PORT" "$source_path" "$(ssh_target):$target_path"
}

detect_remote_compose_command() {
  ssh_cmd "if docker compose version >/dev/null 2>&1; then printf 'docker compose'; elif docker-compose version >/dev/null 2>&1; then printf 'docker-compose'; elif command -v apt-get >/dev/null 2>&1; then export DEBIAN_FRONTEND=noninteractive && apt-get update >/dev/null 2>&1 && (apt-get install -y docker-compose-v2 >/dev/null 2>&1 || apt-get install -y docker-compose-plugin >/dev/null 2>&1 || apt-get install -y docker-compose >/dev/null 2>&1) && if docker compose version >/dev/null 2>&1; then printf 'docker compose'; elif docker-compose version >/dev/null 2>&1; then printf 'docker-compose'; else echo 'Docker Compose installation succeeded but no compose command is available.' >&2; exit 1; fi; else echo 'No Docker Compose command found on remote host.' >&2; exit 1; fi"
}

wait_for_remote_cloud_init() {
  local timeout_seconds="$1"
  local started_at
  started_at="$(date +%s)"

  while true; do
    local status_output
    status_output="$(ssh_cmd "cloud-init status 2>/dev/null || true")"

    if grep -q "status: done" <<<"$status_output"; then
      return 0
    fi

    if grep -q "status: error" <<<"$status_output"; then
      echo "Remote cloud-init finished with errors; continuing with deploy checks." >&2
      ssh_cmd "tail -n 80 /var/log/cloud-init-output.log || true" >&2
      return 0
    fi

    if (( $(date +%s) - started_at >= timeout_seconds )); then
      echo "Timed out waiting for cloud-init after ${timeout_seconds}s." >&2
      ssh_cmd "cloud-init status || true" >&2
      return 1
    fi

    sleep 5
  done
}

stream_worktree_snapshot() {
  tar \
    --exclude=.git \
    --exclude=.env \
    --exclude=infra/.env \
    --exclude=node_modules \
    --exclude=infra/node_modules \
    --exclude=certificates/*.crt \
    --exclude=certificates/*.key \
    --exclude=data/runs \
    --exclude=data/ai/ingest-jobs \
    -cf - \
    -C "$ROOT_DIR" .
}

sync_remote_repository_from_git() {
  ssh_cmd "mkdir -p '$DEPLOY_PATH/data' '$DEPLOY_PATH/certificates'"
  ssh_cmd "git config --global --add safe.directory '$DEPLOY_PATH' && cd '$DEPLOY_PATH' && if [ ! -d .git ]; then git init >/dev/null 2>&1; fi && if ! git remote get-url origin >/dev/null 2>&1; then git remote add origin '$DEPLOY_REMOTE'; fi && git remote set-url origin '$DEPLOY_REMOTE' && git fetch --depth=1 origin '$DEPLOY_BRANCH' && git clean -fdx -e .env -e data -e certificates/*.crt -e certificates/*.key && git checkout -B '$DEPLOY_BRANCH' 'origin/$DEPLOY_BRANCH' && git reset --hard 'origin/$DEPLOY_BRANCH' && git clean -fdx -e .env -e data -e certificates/*.crt -e certificates/*.key"
}

sync_remote_repository_from_local() {
  ssh_cmd "mkdir -p '$DEPLOY_PATH/data' '$DEPLOY_PATH/certificates'"
  ssh_cmd "find '$DEPLOY_PATH' -mindepth 1 -maxdepth 1 ! -name '.env' ! -name 'certificates' ! -name 'data' -exec rm -rf {} +"
  stream_worktree_snapshot | ssh_cmd "tar -xf - -C '$DEPLOY_PATH'"
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
    iac-tooling sh -lc "pulumi login >/dev/null 2>&1 && pulumi stack select dev >/dev/null 2>&1 && pulumi stack output $output_name" | awk 'NF { line = $0 } END { print line }'
}

require_command docker
require_command git
require_command ssh
require_command scp
require_command tar

require_file "$APP_ENV_FILE"
require_file "$INFRA_ENV_FILE"

if [[ "$DEPLOY_SOURCE" != "git" && "$DEPLOY_SOURCE" != "local" ]]; then
  echo "Unsupported PHPSAGE_DEPLOY_SOURCE: $DEPLOY_SOURCE" >&2
  echo "Expected 'git' or 'local'." >&2
  exit 1
fi

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

if [[ "$DEPLOY_SOURCE" == "git" ]]; then
  DEPLOY_REMOTE="$(normalize_remote_url "$DEPLOY_REMOTE")"
fi

echo "Deploy host: $DEPLOY_HOST"
echo "Deploy path: $DEPLOY_PATH"
echo "Deploy source: $DEPLOY_SOURCE"

if [[ "$DEPLOY_WAIT_SECONDS" -gt 0 ]]; then
  echo "Waiting ${DEPLOY_WAIT_SECONDS}s before SSH checks..."
  sleep "$DEPLOY_WAIT_SECONDS"
fi

check_ssh_host_key

echo "Waiting for remote cloud-init to finish..."
wait_for_remote_cloud_init "$DEPLOY_CLOUD_INIT_TIMEOUT_SECONDS"

REMOTE_COMPOSE_COMMAND="$(detect_remote_compose_command)"

ssh_cmd "mkdir -p '$DEPLOY_PATH'"

if [[ "$DEPLOY_SOURCE" == "git" ]]; then
  sync_remote_repository_from_git
else
  sync_remote_repository_from_local
fi

scp_file "$APP_ENV_FILE" "$DEPLOY_PATH/.env"

if [[ -n "${TLS_CERT_RAW:-}" && -n "${TLS_KEY_RAW:-}" ]]; then
  ssh_cmd "mkdir -p '$(dirname "$TLS_CERT_REMOTE")'"
  scp_file "$TLS_CERT_LOCAL" "$TLS_CERT_REMOTE"
  scp_file "$TLS_KEY_LOCAL" "$TLS_KEY_REMOTE"
  ssh_cmd "chmod 644 '$TLS_CERT_REMOTE' && chmod 600 '$TLS_KEY_REMOTE'"
fi

if [[ "$REMOTE_COMPOSE_COMMAND" == "docker-compose" ]]; then
  ssh_cmd "cd '$DEPLOY_PATH' && docker-compose down --remove-orphans || true"
fi

ssh_cmd "cd '$DEPLOY_PATH' && $REMOTE_COMPOSE_COMMAND -f docker-compose.yml -f docker-compose.server.yml up --build -d"

echo "Deployment finished on $(ssh_target)"