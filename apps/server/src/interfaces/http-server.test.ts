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

test("POST /api/runs/:runId/log validates payload and appends logs", async () => {
  const httpServer = await startTestHttpServer();
  const workspaceDir = mkdtempSync(join(tmpdir(), "phpsage-http-log-"));
  const targetPath = join(workspaceDir, "project");
  mkdirSync(targetPath, { recursive: true });

  try {
    const startResponse = await fetch(`${httpServer.baseUrl}/api/runs/start`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ targetPath })
    });

    assert.equal(startResponse.status, 201);
    const startedRun = (await startResponse.json()) as { runId: string };

    const invalidPayloadResponse = await fetch(`${httpServer.baseUrl}/api/runs/${startedRun.runId}/log`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ stream: "stdout" })
    });

    assert.equal(invalidPayloadResponse.status, 400);
    const invalidPayloadBody = (await invalidPayloadResponse.json()) as { error: string };
    assert.match(invalidPayloadBody.error, /stream and message are required/i);

    const notFoundResponse = await fetch(`${httpServer.baseUrl}/api/runs/missing/log`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ stream: "stdout", message: "hello" })
    });

    assert.equal(notFoundResponse.status, 404);

    const appendResponse = await fetch(`${httpServer.baseUrl}/api/runs/${startedRun.runId}/log`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ stream: "stderr", message: "something failed" })
    });

    assert.equal(appendResponse.status, 200);
    const updatedRun = (await appendResponse.json()) as RunRecord;
    assert.equal(updatedRun.logs.length, 1);
    assert.equal(updatedRun.logs[0]?.stream, "stderr");
    assert.equal(updatedRun.logs[0]?.message, "something failed");
  } finally {
    await httpServer.close();
    rmSync(workspaceDir, { recursive: true, force: true });
  }
});

test("POST /api/runs/:runId/finish validates payload and finalizes run", async () => {
  const httpServer = await startTestHttpServer();
  const workspaceDir = mkdtempSync(join(tmpdir(), "phpsage-http-finish-"));
  const targetPath = join(workspaceDir, "project");
  mkdirSync(targetPath, { recursive: true });

  try {
    const startResponse = await fetch(`${httpServer.baseUrl}/api/runs/start`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ targetPath })
    });

    assert.equal(startResponse.status, 201);
    const startedRun = (await startResponse.json()) as { runId: string };

    const invalidPayloadResponse = await fetch(`${httpServer.baseUrl}/api/runs/${startedRun.runId}/finish`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ issues: [], exitCode: "0" })
    });

    assert.equal(invalidPayloadResponse.status, 400);
    const invalidPayloadBody = (await invalidPayloadResponse.json()) as { error: string };
    assert.match(invalidPayloadBody.error, /issues and exitCode are required/i);

    const finishResponse = await fetch(`${httpServer.baseUrl}/api/runs/${startedRun.runId}/finish`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        issues: [
          {
            file: "src/index.php",
            line: 3,
            message: "Undefined variable: $name"
          }
        ],
        exitCode: 1
      })
    });

    assert.equal(finishResponse.status, 200);
    const finishedRun = (await finishResponse.json()) as RunRecord;
    assert.equal(finishedRun.status, "finished");
    assert.equal(finishedRun.exitCode, 1);
    assert.equal(finishedRun.issues.length, 1);

    const notFoundResponse = await fetch(`${httpServer.baseUrl}/api/runs/missing/finish`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ issues: [], exitCode: 0 })
    });

    assert.equal(notFoundResponse.status, 404);
  } finally {
    await httpServer.close();
    rmSync(workspaceDir, { recursive: true, force: true });
  }
});

test("GET /api/runs/:runId/source validates query and returns source content", async () => {
  const httpServer = await startTestHttpServer();
  const workspaceDir = mkdtempSync(join(tmpdir(), "phpsage-http-source-"));
  const targetPath = join(workspaceDir, "project");
  const srcDir = join(targetPath, "src");
  mkdirSync(srcDir, { recursive: true });
  const phpFile = join(srcDir, "index.php");
  writeFileSync(phpFile, "<?php\n$foo = 1;\n");

  try {
    const startResponse = await fetch(`${httpServer.baseUrl}/api/runs/start`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ targetPath })
    });

    assert.equal(startResponse.status, 201);
    const startedRun = (await startResponse.json()) as { runId: string };

    const missingFileParamResponse = await fetch(`${httpServer.baseUrl}/api/runs/${startedRun.runId}/source`);
    assert.equal(missingFileParamResponse.status, 400);

    const notFoundRunResponse = await fetch(
      `${httpServer.baseUrl}/api/runs/missing/source?file=${encodeURIComponent(phpFile)}`
    );
    assert.equal(notFoundRunResponse.status, 404);

    const missingSourceResponse = await fetch(
      `${httpServer.baseUrl}/api/runs/${startedRun.runId}/source?file=${encodeURIComponent(join(srcDir, "missing.php"))}`
    );
    assert.equal(missingSourceResponse.status, 404);

    const sourceResponse = await fetch(
      `${httpServer.baseUrl}/api/runs/${startedRun.runId}/source?file=${encodeURIComponent(phpFile)}`
    );
    assert.equal(sourceResponse.status, 200);
    const sourcePayload = (await sourceResponse.json()) as { file: string; content: string };
    assert.equal(sourcePayload.file, phpFile);
    assert.equal(sourcePayload.content, "<?php\n$foo = 1;\n");
  } finally {
    await httpServer.close();
    rmSync(workspaceDir, { recursive: true, force: true });
  }
});

test("GET /api/runs/:runId/files returns php files merged with issue-only files", async () => {
  const httpServer = await startTestHttpServer();
  const workspaceDir = mkdtempSync(join(tmpdir(), "phpsage-http-files-"));
  const targetPath = join(workspaceDir, "project");
  const srcDir = join(targetPath, "src");
  const vendorDir = join(targetPath, "vendor");
  mkdirSync(srcDir, { recursive: true });
  mkdirSync(vendorDir, { recursive: true });

  const indexedPhpFile = join(srcDir, "index.php");
  writeFileSync(indexedPhpFile, "<?php\necho 'ok';\n");
  writeFileSync(join(srcDir, "README.md"), "ignored");
  writeFileSync(join(vendorDir, "ignored.php"), "<?php\n");

  try {
    const startResponse = await fetch(`${httpServer.baseUrl}/api/runs/start`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ targetPath })
    });

    assert.equal(startResponse.status, 201);
    const startedRun = (await startResponse.json()) as { runId: string };

    const finishResponse = await fetch(`${httpServer.baseUrl}/api/runs/${startedRun.runId}/finish`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        issues: [
          {
            file: indexedPhpFile,
            line: 2,
            message: "Echo used"
          },
          {
            file: "src/missing.php",
            line: 1,
            message: "Missing file issue"
          }
        ],
        exitCode: 1
      })
    });
    assert.equal(finishResponse.status, 200);

    const filesResponse = await fetch(`${httpServer.baseUrl}/api/runs/${startedRun.runId}/files`);
    assert.equal(filesResponse.status, 200);
    const payload = (await filesResponse.json()) as {
      targetPath: string;
      files: Array<{ path: string; issueCount: number; hasIssues: boolean }>;
    };

    assert.equal(payload.targetPath, targetPath);
    assert.deepEqual(
      payload.files,
      [
        { path: "src/index.php", issueCount: 1, hasIssues: true },
        { path: "src/missing.php", issueCount: 1, hasIssues: true }
      ]
    );

    const notFoundResponse = await fetch(`${httpServer.baseUrl}/api/runs/missing/files`);
    assert.equal(notFoundResponse.status, 404);
  } finally {
    await httpServer.close();
    rmSync(workspaceDir, { recursive: true, force: true });
  }
});
