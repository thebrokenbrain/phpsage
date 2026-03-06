#!/usr/bin/env sh
set -eu

# This script validates a full PHPSage OpenAI smoke flow in Docker.

ROOT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
cd "$ROOT_DIR"

TARGET_PATH="${1:-/workspace/examples/php-sample}"

cleanup() {
  docker compose down --remove-orphans >/dev/null 2>&1 || true
}

trap cleanup EXIT INT TERM

echo "[smoke-openai] Starting services (server + web)..."
docker compose up -d --build phpsage-server phpsage-web >/dev/null

echo "[smoke-openai] Running PHPSage analysis on ${TARGET_PATH}..."
analysis_output="$(docker compose run --rm phpsage-cli phpsage phpstan analyse "${TARGET_PATH}" --docker --no-open 2>&1 || true)"
printf '%s\n' "${analysis_output}"

run_id="$(printf '%s\n' "${analysis_output}" | sed -n 's/.*runId=\([^ ]*\).*/\1/p' | tail -n 1)"
if [ -z "${run_id}" ]; then
  echo "[smoke-openai] ERROR: runId could not be extracted from CLI output"
  exit 1
fi

echo "[smoke-openai] Checking API health..."
curl -sf http://localhost:8080/healthz >/dev/null
curl -sf http://localhost:8080/api/ai/health >/tmp/phpsage-ai-health.json

explain_payload='{"issueMessage":"Undefined variable: $undefinedVariable","issueIdentifier":"variable.undefined","filePath":"/workspace/examples/php-sample/src/Broken.php","line":7,"sourceSnippet":"return $undefinedVariable + $value;"}'
curl -sf -X POST http://localhost:8080/api/ai/explain -H 'Content-Type: application/json' -d "${explain_payload}" >/tmp/phpsage-ai-explain.json

curl -sf "http://localhost:8080/api/runs/${run_id}" >/tmp/phpsage-run.json

node -e '
const fs = require("fs");
const run = JSON.parse(fs.readFileSync("/tmp/phpsage-run.json", "utf8"));
const explain = JSON.parse(fs.readFileSync("/tmp/phpsage-ai-explain.json", "utf8"));
const summary = {
  runId: run.runId,
  status: run.status,
  exitCode: run.exitCode,
  issues: Array.isArray(run.issues) ? run.issues.length : 0,
  aiProvider: explain.provider,
  aiSource: explain.source,
  aiFallbackReason: explain.fallbackReason ?? null
};
console.log("[smoke-openai] Summary:");
console.log(JSON.stringify(summary, null, 2));
if (!summary.runId || summary.status !== "finished") {
  process.exit(1);
}
if (summary.aiProvider !== "openai") {
  process.exit(1);
}
' || {
  echo "[smoke-openai] ERROR: validation failed"
  exit 1
}

echo "[smoke-openai] OK"
