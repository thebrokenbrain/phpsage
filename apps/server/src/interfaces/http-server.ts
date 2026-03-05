// This file exposes minimal HTTP routes for server bootstrap and run start lifecycle.
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { existsSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { URL } from "node:url";
import type { RunService } from "../application/run-service.js";

interface StartRunBody {
  targetPath: string;
}

interface TargetPathValidationResult {
  targetPath: string | null;
  error: string | null;
}

export function createHttpServer(runService: RunService) {
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

    writeJson(response, 404, { error: "Not Found" });
  });
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
