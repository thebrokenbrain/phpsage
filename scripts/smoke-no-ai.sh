#!/usr/bin/env sh

set -eu

# This script validates the non-AI end-to-end flow with Docker Compose.
# It starts server/web/docs, runs CLI app+analyse against the sample project,
# and verifies persisted run data through API endpoints.

ROOT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
cd "$ROOT_DIR"

if [ "${KEEP_STACK_UP:-0}" != "1" ]; then
  cleanup() {
    docker compose down --remove-orphans >/dev/null 2>&1 || true
  }
  trap cleanup EXIT INT TERM
fi

echo "[smoke-no-ai] Starting docker services..."
docker compose up -d --build phpsage-server phpsage-web api-docs >/dev/null

echo "[smoke-no-ai] Waiting for /healthz..."
attempt=1
while [ "$attempt" -le 30 ]; do
  if curl -fsS http://localhost:8080/healthz >/dev/null 2>&1; then
    break
  fi
  attempt=$((attempt + 1))
  sleep 1
done

if [ "$attempt" -gt 30 ]; then
  echo "[smoke-no-ai] ERROR: server did not become ready in time"
  exit 1
fi

echo "[smoke-no-ai] Checking web/docs availability..."
curl -fsS -o /dev/null http://localhost:5173
curl -fsS -o /dev/null http://localhost:8081

echo "[smoke-no-ai] Running CLI app smoke..."
docker compose run --rm phpsage-cli phpsage app --docker --no-open >/dev/null

echo "[smoke-no-ai] Running CLI analyse smoke..."
set +e
ANALYSE_OUTPUT="$(docker compose run --rm phpsage-cli phpsage phpstan analyse /workspace/examples/php-sample --docker --no-open --json-summary 2>&1)"
ANALYSE_EXIT=$?
set -e

echo "$ANALYSE_OUTPUT"
if [ "$ANALYSE_EXIT" -ne 1 ]; then
  echo "[smoke-no-ai] ERROR: expected analyse exit code 1 for php-sample, got $ANALYSE_EXIT"
  exit 1
fi

echo "[smoke-no-ai] Validating API run persistence..."
RUNS_JSON="$(curl -fsS http://localhost:8080/api/runs)"

RUN_ID="$(printf '%s' "$RUNS_JSON" | node -e 'let data=""; process.stdin.on("data",(c)=>data+=c); process.stdin.on("end",()=>{const runs=JSON.parse(data); if(!Array.isArray(runs)||runs.length===0){process.exit(2);} runs.sort((a,b)=>new Date(b.updatedAt)-new Date(a.updatedAt)); process.stdout.write(runs[0].runId);});')"

if [ -z "$RUN_ID" ]; then
  echo "[smoke-no-ai] ERROR: no run id found"
  exit 1
fi

DETAIL_JSON="$(curl -fsS "http://localhost:8080/api/runs/$RUN_ID")"
printf '%s' "$DETAIL_JSON" | node -e 'let data=""; process.stdin.on("data",(c)=>data+=c); process.stdin.on("end",()=>{const run=JSON.parse(data); if(run.status!=="finished"){throw new Error("run is not finished");} if(run.exitCode!==1){throw new Error(`unexpected exitCode ${run.exitCode}`);} if(!Array.isArray(run.issues)||run.issues.length===0){throw new Error("run has no issues");} if(!Array.isArray(run.logs)||run.logs.length===0){throw new Error("run has no logs");} console.log(`[smoke-no-ai] latest_run_id=${run.runId} issues=${run.issues.length} logs=${run.logs.length}`);});'

echo "[smoke-no-ai] Validating files/source endpoints..."
curl -fsS "http://localhost:8080/api/runs/$RUN_ID/files" | node -e 'let data=""; process.stdin.on("data",(c)=>data+=c); process.stdin.on("end",()=>{const payload=JSON.parse(data); if(!Array.isArray(payload.files)||payload.files.length===0){throw new Error("files endpoint returned no files");} console.log(`[smoke-no-ai] files_count=${payload.files.length}`);});'

curl -fsS "http://localhost:8080/api/runs/$RUN_ID/source?file=/workspace/examples/php-sample/src/Bootstrap.php" | node -e 'let data=""; process.stdin.on("data",(c)=>data+=c); process.stdin.on("end",()=>{const payload=JSON.parse(data); if(typeof payload.content!=="string"||payload.content.length===0){throw new Error("source endpoint returned empty content");} console.log("[smoke-no-ai] source endpoint ok");});'

echo "[smoke-no-ai] OK"