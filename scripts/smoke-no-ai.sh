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

run_analyse_smoke() {
  target_path="$1"
  expected_exit="$2"

  echo "[smoke-no-ai] Running CLI analyse smoke for $target_path ..."
  set +e
  analyse_output="$(docker compose run --rm phpsage-cli phpsage phpstan analyse "$target_path" --docker --no-open --json-summary 2>&1)"
  analyse_exit=$?
  set -e

  echo "$analyse_output"
  if [ "$analyse_exit" -ne "$expected_exit" ]; then
    echo "[smoke-no-ai] ERROR: expected analyse exit code $expected_exit for $target_path, got $analyse_exit"
    exit 1
  fi
}

run_analyse_smoke "/workspace/examples/php-sample" 1
run_analyse_smoke "/workspace/examples/php-sample-ok" 0

echo "[smoke-no-ai] Validating API run persistence..."
RUNS_JSON="$(curl -fsS http://localhost:8080/api/runs)"

ERROR_RUN_ID="$(printf '%s' "$RUNS_JSON" | node -e 'let data=""; process.stdin.on("data",(c)=>data+=c); process.stdin.on("end",()=>{const runs=JSON.parse(data); const target="/workspace/examples/php-sample"; if(!Array.isArray(runs)){process.exit(2);} const candidates=runs.filter((run)=>run.targetPath===target); if(candidates.length===0){process.exit(3);} candidates.sort((a,b)=>new Date(b.updatedAt)-new Date(a.updatedAt)); process.stdout.write(candidates[0].runId);});')"

OK_RUN_ID="$(printf '%s' "$RUNS_JSON" | node -e 'let data=""; process.stdin.on("data",(c)=>data+=c); process.stdin.on("end",()=>{const runs=JSON.parse(data); const target="/workspace/examples/php-sample-ok"; if(!Array.isArray(runs)){process.exit(2);} const candidates=runs.filter((run)=>run.targetPath===target); if(candidates.length===0){process.exit(3);} candidates.sort((a,b)=>new Date(b.updatedAt)-new Date(a.updatedAt)); process.stdout.write(candidates[0].runId);});')"

if [ -z "$ERROR_RUN_ID" ] || [ -z "$OK_RUN_ID" ]; then
  echo "[smoke-no-ai] ERROR: could not resolve run ids for sample and sample-ok"
  exit 1
fi

ERROR_DETAIL_JSON="$(curl -fsS "http://localhost:8080/api/runs/$ERROR_RUN_ID")"
printf '%s' "$ERROR_DETAIL_JSON" | node -e 'let data=""; process.stdin.on("data",(c)=>data+=c); process.stdin.on("end",()=>{const run=JSON.parse(data); if(run.status!=="finished"){throw new Error("error-sample run is not finished");} if(run.exitCode!==1){throw new Error(`unexpected error-sample exitCode ${run.exitCode}`);} if(!Array.isArray(run.issues)||run.issues.length===0){throw new Error("error-sample run has no issues");} if(!Array.isArray(run.logs)||run.logs.length===0){throw new Error("error-sample run has no logs");} console.log(`[smoke-no-ai] error_run_id=${run.runId} issues=${run.issues.length} logs=${run.logs.length}`);});'

OK_DETAIL_JSON="$(curl -fsS "http://localhost:8080/api/runs/$OK_RUN_ID")"
printf '%s' "$OK_DETAIL_JSON" | node -e 'let data=""; process.stdin.on("data",(c)=>data+=c); process.stdin.on("end",()=>{const run=JSON.parse(data); if(run.status!=="finished"){throw new Error("ok-sample run is not finished");} if(run.exitCode!==0){throw new Error(`unexpected ok-sample exitCode ${run.exitCode}`);} if(!Array.isArray(run.issues)||run.issues.length!==0){throw new Error("ok-sample run has issues");} if(!Array.isArray(run.logs)||run.logs.length===0){throw new Error("ok-sample run has no logs");} console.log(`[smoke-no-ai] ok_run_id=${run.runId} issues=${run.issues.length} logs=${run.logs.length}`);});'

echo "[smoke-no-ai] Validating files/source endpoints..."
curl -fsS "http://localhost:8080/api/runs/$ERROR_RUN_ID/files" | node -e 'let data=""; process.stdin.on("data",(c)=>data+=c); process.stdin.on("end",()=>{const payload=JSON.parse(data); if(!Array.isArray(payload.files)||payload.files.length===0){throw new Error("error-sample files endpoint returned no files");} console.log(`[smoke-no-ai] error_files_count=${payload.files.length}`);});'

curl -fsS "http://localhost:8080/api/runs/$OK_RUN_ID/files" | node -e 'let data=""; process.stdin.on("data",(c)=>data+=c); process.stdin.on("end",()=>{const payload=JSON.parse(data); if(!Array.isArray(payload.files)||payload.files.length===0){throw new Error("ok-sample files endpoint returned no files");} console.log(`[smoke-no-ai] ok_files_count=${payload.files.length}`);});'

curl -fsS "http://localhost:8080/api/runs/$ERROR_RUN_ID/source?file=/workspace/examples/php-sample/src/Bootstrap.php" | node -e 'let data=""; process.stdin.on("data",(c)=>data+=c); process.stdin.on("end",()=>{const payload=JSON.parse(data); if(typeof payload.content!=="string"||payload.content.length===0){throw new Error("error-sample source endpoint returned empty content");} console.log("[smoke-no-ai] error-source endpoint ok");});'

curl -fsS "http://localhost:8080/api/runs/$OK_RUN_ID/source?file=/workspace/examples/php-sample-ok/src/Main.php" | node -e 'let data=""; process.stdin.on("data",(c)=>data+=c); process.stdin.on("end",()=>{const payload=JSON.parse(data); if(typeof payload.content!=="string"||payload.content.length===0){throw new Error("ok-sample source endpoint returned empty content");} console.log("[smoke-no-ai] ok-source endpoint ok");});'

echo "[smoke-no-ai] OK"