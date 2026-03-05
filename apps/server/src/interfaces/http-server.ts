// This file exposes minimal HTTP routes for server bootstrap and run start lifecycle.
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { existsSync, statSync } from "node:fs";
import { isAbsolute, relative, resolve } from "node:path";
import { URL } from "node:url";
import { RunService } from "../application/run-service.js";
import type { RunIssue } from "../domain/run.js";
import type { RunSourceReader } from "../infrastructure/run-source-reader.js";

interface StartRunBody {
  targetPath: string;
}

interface AppendLogBody {
  stream: "stdout" | "stderr";
  message: string;
}

interface FinishRunBody {
  issues: RunIssue[];
  exitCode: number;
}

interface TargetPathValidationResult {
  targetPath: string | null;
  error: string | null;
}

export function createHttpServer(runService: RunService, runSourceReader: RunSourceReader) {
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
      writeJson(response, 200, { status: "ok" });
      return;
    }

    if (method === "GET" && requestUrl.pathname === "/api/runs") {
      const runs = await runService.list();
      writeJson(response, 200, runs);
      return;
    }

    const runIdFromPath = getRunIdFromPath(requestUrl.pathname);
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

function getRunIdByAction(pathname: string, action: "log" | "finish" | "source" | "files"): string | null {
  const match = pathname.match(new RegExp(`^/api/runs/([^/]+)/${action}$`));
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

function applyCorsHeaders(response: ServerResponse): void {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type");
}
