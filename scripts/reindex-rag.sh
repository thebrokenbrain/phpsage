#!/usr/bin/env sh
set -eu

# Trigger a full RAG reindex job and optionally wait for completion.
# Usage: scripts/reindex-rag.sh [target-path] [--wait]

ROOT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
cd "$ROOT_DIR"

TARGET_PATH="${1:-/workspace/docs/phpstan}"
WAIT_MODE="${2:-}"

if [ "${TARGET_PATH}" = "--wait" ]; then
  TARGET_PATH="/workspace/docs/phpstan"
  WAIT_MODE="--wait"
fi

echo "[reindex-rag] Ensuring required services are running..."
docker compose up -d phpsage-server qdrant >/dev/null

echo "[reindex-rag] Waiting for API health..."
until [ "$(curl -sS -o /dev/null -w '%{http_code}' http://localhost:8080/healthz || true)" = "200" ]; do
  sleep 1
done

echo "[reindex-rag] Triggering ingest for target: ${TARGET_PATH}"
response="$(curl -sS -X POST http://localhost:8080/api/ai/ingest -H 'Content-Type: application/json' -d "{\"targetPath\":\"${TARGET_PATH}\"}")"
job_id="$(printf '%s\n' "${response}" | sed -nE 's/.*"jobId":"([^"]+)".*/\1/p')"

if [ -z "${job_id}" ]; then
  echo "[reindex-rag] ERROR: could not extract jobId from response"
  printf '%s\n' "${response}"
  exit 1
fi

echo "[reindex-rag] jobId=${job_id}"

echo "[reindex-rag] Job details:"
curl -sS "http://localhost:8080/api/ai/ingest/${job_id}"
echo

if [ "${WAIT_MODE}" = "--wait" ]; then
  echo "[reindex-rag] Waiting for completion..."

  for i in $(seq 1 120); do
    body="$(curl -sS "http://localhost:8080/api/ai/ingest/${job_id}")"
    status="$(printf '%s\n' "${body}" | sed -nE 's/.*"status":"([^"]+)".*/\1/p')"

    echo "[reindex-rag] poll[${i}] status=${status}"

    if [ "${status}" = "completed" ]; then
      echo "[reindex-rag] Completed successfully"
      printf '%s\n' "${body}"
      exit 0
    fi

    if [ "${status}" = "failed" ]; then
      echo "[reindex-rag] Failed"
      printf '%s\n' "${body}"
      exit 1
    fi

    sleep 1
  done

  echo "[reindex-rag] Timeout waiting for ingest completion"
  exit 1
fi
