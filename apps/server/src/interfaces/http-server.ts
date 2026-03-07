// This file exposes minimal HTTP routes for server bootstrap and run start lifecycle.
import { spawn } from "node:child_process";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { existsSync, statSync } from "node:fs";
import { isAbsolute, relative, resolve } from "node:path";
import { URL } from "node:url";
import { parsePhpstanJsonOutput } from "@phpsage/shared";
import type { AiExplainService } from "../application/ai-explain-service.js";
import type { AiIngestService } from "../application/ai-ingest-service.js";
import type { AiSuggestFixService } from "../application/ai-suggest-fix-service.js";
import { RunService } from "../application/run-service.js";
import type { RunIssue } from "../domain/run.js";
import type { RunSourceReader } from "../infrastructure/run-source-reader.js";

interface StartRunBody {
  targetPath: string;
  execute?: boolean;
}

interface AppendLogBody {
  stream: "stdout" | "stderr";
  message: string;
}

interface FinishRunBody {
  issues: RunIssue[];
  exitCode: number;
}

interface ExplainBody {
  issueMessage: string;
  issueIdentifier?: string;
  filePath?: string;
  line?: number;
  sourceSnippet?: string;
}

interface IngestBody {
  targetPath?: string;
}

type AiIngestStatus = "queued" | "running" | "completed" | "failed";

interface TargetPathValidationResult {
  targetPath: string | null;
  error: string | null;
}

interface AiHealthResponse {
  status: "ok" | "degraded";
  enabled: boolean;
  activeProvider: string | null;
  activeModel: string | null;
  timestamp: string;
  providers: AiProviderHealth[];
}

interface AiProviderHealth {
  provider: "openai" | "ollama" | "qdrant";
  url: string;
  status: "up" | "down";
  latencyMs: number;
  error: string | null;
}

export function createHttpServer(
  runService: RunService,
  runSourceReader: RunSourceReader,
  aiIngestService: AiIngestService,
  aiExplainService: AiExplainService,
  aiSuggestFixService: AiSuggestFixService
) {
  return createServer(async (request, response) => {
    applyCorsHeaders(response);

    const method = request.method ?? "GET";
    const requestUrl = new URL(request.url ?? "/", "http://localhost");

    if (method === "OPTIONS") {
      response.statusCode = 204;
      response.end();
      return;
    }

    if (method === "GET" && requestUrl.pathname === "/healthz") {
      writeText(response, 200, "ok");
      return;
    }

    if (method === "GET" && requestUrl.pathname === "/api/ai/health") {
      writeJson(response, 200, await getAiHealth());
      return;
    }

    if (method === "GET" && requestUrl.pathname === "/api/runs") {
      const runs = await runService.list();
      writeJson(response, 200, runs);
      return;
    }

    if (method === "POST" && requestUrl.pathname === "/api/ai/ingest") {
      const body = (await readJsonBody(request)) as IngestBody | null;
      const requestedTargetPath = typeof body?.targetPath === "string" ? body.targetPath.trim() : "";
      const targetPath = requestedTargetPath || process.env.AI_INGEST_DEFAULT_TARGET || "/workspace/docs/phpstan";

      const job = await aiIngestService.start(targetPath);
      writeJson(response, 202, job);
      return;
    }

    if (method === "GET" && requestUrl.pathname === "/api/ai/ingest") {
      const limitParam = requestUrl.searchParams.get("limit");
      const parsedLimit = limitParam ? Number.parseInt(limitParam, 10) : 10;
      const limit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : 10;
      const statusParam = requestUrl.searchParams.get("status");
      const status = parseAiIngestStatus(statusParam);

      if (statusParam !== null && status === null) {
        writeJson(response, 400, { error: "status must be one of queued|running|completed|failed" });
        return;
      }

      const jobs = status
        ? (await aiIngestService.listRecent(1000)).filter((job) => job.status === status).slice(0, limit)
        : await aiIngestService.listRecent(limit);
      writeJson(response, 200, jobs);
      return;
    }

    if (method === "GET" && requestUrl.pathname === "/api/ai/ingest/latest") {
      const latestJob = await aiIngestService.getLatest();
      if (!latestJob) {
        writeJson(response, 404, { error: "Ingest job not found" });
        return;
      }

      writeJson(response, 200, latestJob);
      return;
    }

    const ingestJobId = getAiIngestJobId(requestUrl.pathname);
    if (method === "GET" && ingestJobId) {
      const job = await aiIngestService.getById(ingestJobId);
      if (!job) {
        writeJson(response, 404, { error: "Ingest job not found" });
        return;
      }

      writeJson(response, 200, job);
      return;
    }

    if (method === "POST" && requestUrl.pathname === "/api/ai/explain") {
      const body = (await readJsonBody(request)) as ExplainBody | null;
      const issueMessage = typeof body?.issueMessage === "string" ? body.issueMessage.trim() : "";

      if (!issueMessage) {
        writeJson(response, 400, { error: "issueMessage is required" });
        return;
      }

      const explanation = await aiExplainService.explain({
        issueMessage,
        issueIdentifier: typeof body?.issueIdentifier === "string" ? body.issueIdentifier : undefined,
        filePath: typeof body?.filePath === "string" ? body.filePath : undefined,
        line: typeof body?.line === "number" ? body.line : undefined,
        sourceSnippet: typeof body?.sourceSnippet === "string" ? body.sourceSnippet : undefined
      });

      writeJson(response, 200, explanation);
      return;
    }

    if (method === "POST" && requestUrl.pathname === "/api/ai/suggest-fix") {
      const body = (await readJsonBody(request)) as ExplainBody | null;
      const issueMessage = typeof body?.issueMessage === "string" ? body.issueMessage.trim() : "";

      if (!issueMessage) {
        writeJson(response, 400, { error: "issueMessage is required" });
        return;
      }

      const suggestion = await aiSuggestFixService.suggestFix({
        issueMessage,
        issueIdentifier: typeof body?.issueIdentifier === "string" ? body.issueIdentifier : undefined,
        filePath: typeof body?.filePath === "string" ? body.filePath : undefined,
        line: typeof body?.line === "number" ? body.line : undefined,
        sourceSnippet: typeof body?.sourceSnippet === "string" ? body.sourceSnippet : undefined
      });

      writeJson(response, 200, suggestion);
      return;
    }

    const runIdFromPath = getRunIdFromPath(requestUrl.pathname);
    if (method === "DELETE" && runIdFromPath) {
      const deleted = await runService.delete(runIdFromPath);
      if (!deleted) {
        writeJson(response, 404, { error: "Run not found" });
        return;
      }

      response.statusCode = 204;
      response.end();
      return;
    }

    if (method === "GET" && runIdFromPath) {
      const run = await runService.getById(runIdFromPath);
      if (!run) {
        writeJson(response, 404, { error: "Run not found" });
        return;
      }

      writeJson(response, 200, run);
      return;
    }

    const runIdForSourceGet = getRunIdByAction(requestUrl.pathname, "source");
    if (method === "GET" && runIdForSourceGet) {
      const filePath = requestUrl.searchParams.get("file") ?? "";
      if (!filePath) {
        writeJson(response, 400, { error: "file query parameter is required" });
        return;
      }

      const run = await runService.getById(runIdForSourceGet);
      if (!run) {
        writeJson(response, 404, { error: "Run not found" });
        return;
      }

      const source = await runSourceReader.read(run.targetPath, filePath);
      if (source === null) {
        writeJson(response, 404, { error: "Source file not found" });
        return;
      }

      writeJson(response, 200, { file: filePath, content: source });
      return;
    }

    const runIdForFilesGet = getRunIdByAction(requestUrl.pathname, "files");
    if (method === "GET" && runIdForFilesGet) {
      const run = await runService.getById(runIdForFilesGet);
      if (!run) {
        writeJson(response, 404, { error: "Run not found" });
        return;
      }

      const files = await runSourceReader.listFiles(run.targetPath);
      const issueCountByFile = getIssueCountByRelativeFile(run.targetPath, run.issues);
      const issueOnlyFiles = Array.from(issueCountByFile.keys()).filter((filePath) => !files.includes(filePath));
      const allFiles = [...files, ...issueOnlyFiles].sort((left, right) => left.localeCompare(right));

      writeJson(response, 200, {
        targetPath: run.targetPath,
        files: allFiles.map((filePath) => {
          const issueCount = issueCountByFile.get(filePath) ?? 0;
          return {
            path: filePath,
            issueCount,
            hasIssues: issueCount > 0
          };
        })
      });
      return;
    }

    if (method === "POST" && requestUrl.pathname === "/api/runs/start") {
      const body = (await readJsonBody(request)) as StartRunBody | null;
      const targetPathValidation = validateRunTargetPath(body?.targetPath);
      if (targetPathValidation.error || !targetPathValidation.targetPath) {
        writeJson(response, 400, { error: targetPathValidation.error ?? "targetPath is required" });
        return;
      }

      const run = await runService.start(targetPathValidation.targetPath);
      if (body?.execute === true) {
        void executeRerunAnalysis(runService, run.runId, run.targetPath);
      }
      writeJson(response, 201, run);
      return;
    }

    const runIdForLog = getRunIdByAction(requestUrl.pathname, "log");
    if (method === "POST" && runIdForLog) {
      const body = await readJsonBody(request) as AppendLogBody | null;
      const stream = body?.stream;
      const message = body?.message;

      if ((stream !== "stdout" && stream !== "stderr") || typeof message !== "string" || !message) {
        writeJson(response, 400, { error: "stream and message are required" });
        return;
      }

      const run = await runService.appendLog(runIdForLog, stream, message);
      if (!run) {
        writeJson(response, 404, { error: "Run not found" });
        return;
      }

      writeJson(response, 200, run);
      return;
    }

    const runIdForFinish = getRunIdByAction(requestUrl.pathname, "finish");
    if (method === "POST" && runIdForFinish) {
      const body = await readJsonBody(request) as FinishRunBody | null;
      const issues = body?.issues;
      const exitCode = body?.exitCode;

      if (!RunService.isRunIssueList(issues) || typeof exitCode !== "number") {
        writeJson(response, 400, { error: "issues and exitCode are required" });
        return;
      }

      const run = await runService.finish(runIdForFinish, issues, exitCode);
      if (!run) {
        writeJson(response, 404, { error: "Run not found" });
        return;
      }

      writeJson(response, 200, run);
      return;
    }

    writeJson(response, 404, { error: "Not Found" });
  });
}

async function getAiHealth(): Promise<AiHealthResponse> {
  const providerFromEnv = process.env.AI_PROVIDER?.trim();
  const openAiApiKey = process.env.OPENAI_API_KEY?.trim();
  const activeProvider = providerFromEnv && providerFromEnv.length > 0
    ? providerFromEnv
    : (openAiApiKey && openAiApiKey.length > 0 ? "openai" : null);
  const activeModel = activeProvider
    ? (
      process.env.PHPSAGE_AI_MODEL?.trim()
      || (activeProvider === "openai" ? process.env.OPENAI_MODEL?.trim() : process.env.OLLAMA_MODEL?.trim())
      || null
    )
    : null;

  const timeoutMs = readPositiveIntegerEnvOrDefault("AI_HEALTH_TIMEOUT_MS", 5000);
  const providers = await Promise.all([
    probeHealth({
      provider: "openai",
      url: process.env.OPENAI_HEALTH_URL?.trim() || `${(process.env.OPENAI_BASE_URL?.trim() || "https://api.openai.com").replace(/\/+$/, "")}/v1/models`,
      timeoutMs,
      headers: openAiApiKey ? { Authorization: `Bearer ${openAiApiKey}` } : undefined
    }),
    probeHealth({
      provider: "ollama",
      url: `${(process.env.OLLAMA_BASE_URL?.trim() || "http://ollama:11434").replace(/\/+$/, "")}/api/tags`,
      timeoutMs
    }),
    probeHealth({
      provider: "qdrant",
      url: `${(process.env.QDRANT_URL?.trim() || "http://qdrant:6333").replace(/\/+$/, "")}/healthz`,
      timeoutMs
    })
  ]);

  const isActiveProviderHealthy = activeProvider === null
    ? true
    : providers.some((provider) => provider.provider === activeProvider && provider.status === "up");

  return {
    status: isActiveProviderHealthy ? "ok" : "degraded",
    enabled: activeProvider !== null,
    activeProvider,
    activeModel,
    timestamp: new Date().toISOString(),
    providers
  };
}

interface AiHealthProbeRequest {
  provider: AiProviderHealth["provider"];
  url: string;
  timeoutMs: number;
  headers?: Record<string, string>;
}

async function probeHealth(request: AiHealthProbeRequest): Promise<AiProviderHealth> {
  const startedAt = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort();
  }, request.timeoutMs);

  try {
    const response = await fetch(request.url, {
      method: "GET",
      headers: request.headers,
      signal: controller.signal
    });

    const latencyMs = Date.now() - startedAt;
    if (response.ok) {
      return {
        provider: request.provider,
        url: request.url,
        status: "up",
        latencyMs,
        error: null
      };
    }

    return {
      provider: request.provider,
      url: request.url,
      status: "down",
      latencyMs,
      error: `HTTP ${response.status}`
    };
  } catch (error) {
    return {
      provider: request.provider,
      url: request.url,
      status: "down",
      latencyMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : String(error)
    };
  } finally {
    clearTimeout(timeout);
  }
}

function readPositiveIntegerEnvOrDefault(name: string, fallback: number): number {
  const rawValue = process.env[name];
  if (!rawValue || rawValue.trim().length === 0) {
    return fallback;
  }

  const parsedValue = Number.parseInt(rawValue.trim(), 10);
  if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
    return fallback;
  }

  return parsedValue;
}

function getRunIdByAction(pathname: string, action: "log" | "finish" | "source" | "files"): string | null {
  const match = pathname.match(new RegExp(`^/api/runs/([^/]+)/${action}$`));
  return match?.[1] ?? null;
}

function parseAiIngestStatus(value: string | null): AiIngestStatus | null {
  if (!value) {
    return null;
  }

  switch (value) {
    case "queued":
    case "running":
    case "completed":
    case "failed":
      return value;
    default:
      return null;
  }
}

function getAiIngestJobId(pathname: string): string | null {
  const match = pathname.match(/^\/api\/ai\/ingest\/([^/]+)$/);
  return match?.[1] ?? null;
}

function getRunIdFromPath(pathname: string): string | null {
  const match = pathname.match(/^\/api\/runs\/([^/]+)$/);
  return match?.[1] ?? null;
}

function getIssueCountByRelativeFile(targetPath: string, issues: RunIssue[]): Map<string, number> {
  const counts = new Map<string, number>();
  const resolvedTargetPath = resolve(targetPath);

  for (const issue of issues) {
    const resolvedIssuePath = isAbsolute(issue.file) ? resolve(issue.file) : resolve(resolvedTargetPath, issue.file);
    const relativeIssuePath = relative(resolvedTargetPath, resolvedIssuePath).replace(/\\/g, "/");
    if (relativeIssuePath.startsWith("..") || relativeIssuePath.length === 0) {
      continue;
    }

    counts.set(relativeIssuePath, (counts.get(relativeIssuePath) ?? 0) + 1);
  }

  return counts;
}

async function executeRerunAnalysis(runService: RunService, runId: string, targetPath: string): Promise<void> {
  const execution = await executePhpstan(targetPath);

  if (execution.stdout.trim()) {
    await runService.appendLog(runId, "stdout", execution.stdout.trimEnd());
  }

  if (execution.stderr.trim()) {
    await runService.appendLog(runId, "stderr", execution.stderr.trimEnd());
  }

  const issues = parseIssues(execution.stdout, execution.stderr);
  await runService.finish(runId, issues, execution.exitCode);
}

async function executePhpstan(targetPath: string): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const args = ["analyse", targetPath, "--error-format=json", "--no-progress"];
  const configPath = resolve(targetPath, "phpstan.neon");
  if (existsSync(configPath)) {
    args.push(`--configuration=${configPath}`);
  }

  const stdoutChunks: string[] = [];
  const stderrChunks: string[] = [];

  const exitCode = await new Promise<number>((resolveExitCode) => {
    const child = spawn("phpstan", args, {
      cwd: process.cwd(),
      stdio: ["ignore", "pipe", "pipe"]
    });

    child.stdout.on("data", (chunk: Buffer) => {
      stdoutChunks.push(chunk.toString("utf-8"));
    });

    child.stderr.on("data", (chunk: Buffer) => {
      stderrChunks.push(chunk.toString("utf-8"));
    });

    child.on("error", (error) => {
      stderrChunks.push(`PHPStan execution failed: ${error.message}\n`);
      resolveExitCode(1);
    });

    child.on("close", (code) => {
      resolveExitCode(typeof code === "number" ? code : 1);
    });
  });

  return {
    stdout: stdoutChunks.join(""),
    stderr: stderrChunks.join(""),
    exitCode
  };
}

function parseIssues(stdout: string, stderr: string): RunIssue[] {
  const fromStdout = parsePhpstanJsonOutput(stdout);
  if (fromStdout.length > 0) {
    return fromStdout;
  }

  return parsePhpstanJsonOutput(stderr);
}

function validateRunTargetPath(rawTargetPath: unknown): TargetPathValidationResult {
  if (typeof rawTargetPath !== "string" || rawTargetPath.trim().length === 0) {
    return {
      targetPath: null,
      error: "targetPath is required"
    };
  }

  const normalizedTargetPath = resolve(rawTargetPath.trim());
  if (!existsSync(normalizedTargetPath)) {
    return {
      targetPath: null,
      error: "targetPath does not exist"
    };
  }

  if (!statSync(normalizedTargetPath).isDirectory()) {
    return {
      targetPath: null,
      error: "targetPath must be a directory"
    };
  }

  return {
    targetPath: normalizedTargetPath,
    error: null
  };
}

async function readJsonBody(request: IncomingMessage): Promise<Record<string, unknown> | null> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  const raw = Buffer.concat(chunks).toString("utf-8").trim();
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function writeJson(response: ServerResponse, statusCode: number, body: unknown): void {
  response.statusCode = statusCode;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.end(JSON.stringify(body));
}

function writeText(response: ServerResponse, statusCode: number, body: string): void {
  response.statusCode = statusCode;
  response.setHeader("Content-Type", "text/plain; charset=utf-8");
  response.end(body);
}

function applyCorsHeaders(response: ServerResponse): void {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type");
}
