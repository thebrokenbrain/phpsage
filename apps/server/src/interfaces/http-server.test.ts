// This file tests HTTP run start validations and happy path behavior.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHttpServer } from "./http-server.js";
import { RunService } from "../application/run-service.js";
import type { RunRecord, RunSummary } from "../domain/run.js";
import type { RunRepository } from "../ports/run-repository.js";
import { RunSourceReader } from "../infrastructure/run-source-reader.js";

class InMemoryRunRepository implements RunRepository {
  private readonly runs = new Map<string, RunRecord>();

  public async save(run: RunRecord): Promise<void> {
    this.runs.set(run.runId, run);
  }

  public async findById(runId: string): Promise<RunRecord | null> {
    return this.runs.get(runId) ?? null;
  }

  public async listSummaries(): Promise<RunSummary[]> {
    return Array.from(this.runs.values()).map((run) => ({
      runId: run.runId,
      targetPath: run.targetPath,
      status: run.status,
      createdAt: run.createdAt,
      updatedAt: run.updatedAt,
      exitCode: run.exitCode,
      issueCount: run.issues.length
    }));
  }
}

async function startTestHttpServer(): Promise<{ baseUrl: string; close: () => Promise<void> }> {
  const runService = new RunService(new InMemoryRunRepository());
  const runSourceReader = new RunSourceReader();
  const server = createHttpServer(runService, runSourceReader);

  await new Promise<void>((resolveStart) => {
    server.listen(0, "127.0.0.1", () => {
      resolveStart();
    });
  });

  const address = server.address();
  assert.ok(address && typeof address !== "string");

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: () => {
      return new Promise<void>((resolveClose, rejectClose) => {
        server.close((error) => {
          if (error) {
            rejectClose(error);
            return;
          }

          resolveClose();
        });
      });
    }
  };
}

test("POST /api/runs/start validates missing targetPath", async () => {
  const httpServer = await startTestHttpServer();

  try {
    const response = await fetch(`${httpServer.baseUrl}/api/runs/start`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({})
    });

    assert.equal(response.status, 400);
    const payload = (await response.json()) as { error: string };
    assert.match(payload.error, /targetPath is required/i);
  } finally {
    await httpServer.close();
  }
});

test("POST /api/runs/start validates targetPath must exist and be directory", async () => {
  const httpServer = await startTestHttpServer();
  const workspaceDir = mkdtempSync(join(tmpdir(), "phpsage-http-start-"));
  const singleFile = join(workspaceDir, "single.php");
  writeFileSync(singleFile, "<?php\n echo 'ok';\n");

  try {
    const missingResponse = await fetch(`${httpServer.baseUrl}/api/runs/start`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ targetPath: join(workspaceDir, "missing") })
    });

    assert.equal(missingResponse.status, 400);
    const missingPayload = (await missingResponse.json()) as { error: string };
    assert.match(missingPayload.error, /targetPath does not exist/i);

    const fileResponse = await fetch(`${httpServer.baseUrl}/api/runs/start`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ targetPath: singleFile })
    });

    assert.equal(fileResponse.status, 400);
    const filePayload = (await fileResponse.json()) as { error: string };
    assert.match(filePayload.error, /must be a directory/i);
  } finally {
    await httpServer.close();
    rmSync(workspaceDir, { recursive: true, force: true });
  }
});

test("POST /api/runs/start returns created run for valid targetPath", async () => {
  const httpServer = await startTestHttpServer();
  const workspaceDir = mkdtempSync(join(tmpdir(), "phpsage-http-start-"));
  const targetPath = join(workspaceDir, "project");
  mkdirSync(targetPath, { recursive: true });

  try {
    const response = await fetch(`${httpServer.baseUrl}/api/runs/start`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ targetPath })
    });

    assert.equal(response.status, 201);
    const payload = (await response.json()) as { runId: string; targetPath: string; status: string };
    assert.ok(payload.runId.length > 0);
    assert.equal(payload.status, "running");
    assert.equal(payload.targetPath, targetPath);
  } finally {
    await httpServer.close();
    rmSync(workspaceDir, { recursive: true, force: true });
  }
});
