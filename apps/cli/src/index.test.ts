// This file validates CLI integration behavior for json summary, timeout and watch modes.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { chmodSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

interface RunFinishPayload {
  issues: unknown[];
  exitCode: number;
}

interface MockServerState {
  startCount: number;
  finishPayloads: RunFinishPayload[];
  logCount: number;
  ingestCreateCount: number;
  ingestGetCount: number;
  ingestListCount: number;
}

interface MockServer {
  url: string;
  state: MockServerState;
  close: () => Promise<void>;
}

function getCliEntryPath(): string {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  return resolve(currentDir, "index.js");
}

function createTempWorkspace(): string {
  const directory = mkdtempSync(join(tmpdir(), "phpsage-cli-test-"));
  mkdirSync(join(directory, "target"), { recursive: true });
  writeFileSync(join(directory, "target", "Sample.php"), "<?php\n echo 'ok';\n");
  return directory;
}

function createMockPhpstanBinary(workspaceDir: string, content: string): string {
  const scriptPath = join(workspaceDir, "mock-phpstan.js");
  writeFileSync(scriptPath, content);
  chmodSync(scriptPath, 0o755);
  return scriptPath;
}

function readRequestBody(request: IncomingMessage): Promise<string> {
  return new Promise((resolveBody) => {
    let raw = "";
    request.setEncoding("utf-8");
    request.on("data", (chunk) => {
      raw += chunk;
    });
    request.on("end", () => {
      resolveBody(raw);
    });
  });
}

async function startMockServer(): Promise<MockServer> {
  const state: MockServerState = {
    startCount: 0,
    finishPayloads: [],
    logCount: 0,
    ingestCreateCount: 0,
    ingestGetCount: 0,
    ingestListCount: 0
  };

  const server = createServer(async (request: IncomingMessage, response: ServerResponse) => {
    if (!request.url) {
      response.statusCode = 400;
      response.end("missing url");
      return;
    }

    if (request.method === "GET" && request.url === "/healthz") {
      response.statusCode = 200;
      response.end("ok");
      return;
    }

    if (request.method === "POST" && request.url === "/api/runs/start") {
      state.startCount += 1;
      await readRequestBody(request);
      response.setHeader("content-type", "application/json");
      response.end(JSON.stringify({ runId: `run-${state.startCount}` }));
      return;
    }

    if (request.method === "POST" && request.url === "/api/ai/ingest") {
      state.ingestCreateCount += 1;
      const rawBody = await readRequestBody(request);
      const body = rawBody ? (JSON.parse(rawBody) as { targetPath?: string }) : {};

      response.setHeader("content-type", "application/json");
      response.end(
        JSON.stringify({
          jobId: `job-${state.ingestCreateCount}`,
          targetPath: body.targetPath ?? "/workspace/examples/php-sample",
          status: "queued",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          startedAt: null,
          finishedAt: null,
          error: null,
          stats: null
        })
      );
      return;
    }

    if (request.method === "GET" && request.url.startsWith("/api/ai/ingest?") ) {
      state.ingestListCount += 1;
      const url = new URL(request.url, "http://localhost");
      const statusFilter = url.searchParams.get("status");

      const jobs = [
        {
          jobId: "job-3",
          targetPath: "/workspace/docs/rag",
          status: "failed",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          startedAt: new Date().toISOString(),
          finishedAt: new Date().toISOString(),
          error: "bad target",
          stats: null
        },
        {
          jobId: "job-2",
          targetPath: "/workspace/examples/php-sample",
          status: "completed",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          startedAt: new Date().toISOString(),
          finishedAt: new Date().toISOString(),
          error: null,
          stats: { filesIndexed: 2, chunksIndexed: 4 }
        }
      ];

      const filteredJobs = statusFilter ? jobs.filter((job) => job.status === statusFilter) : jobs;

      response.setHeader("content-type", "application/json");
      response.end(JSON.stringify(filteredJobs));
      return;
    }

    if (request.method === "GET" && request.url.startsWith("/api/ai/ingest/")) {
      state.ingestGetCount += 1;
      const status = state.ingestGetCount >= 2 ? "completed" : "running";
      response.setHeader("content-type", "application/json");
      response.end(
        JSON.stringify({
          jobId: request.url.split("/").pop(),
          targetPath: "/workspace/examples/php-sample",
          status,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          startedAt: new Date().toISOString(),
          finishedAt: status === "completed" ? new Date().toISOString() : null,
          error: null,
          stats: status === "completed" ? { filesIndexed: 3, chunksIndexed: 10 } : null
        })
      );
      return;
    }

    if (request.method === "POST" && request.url.includes("/api/runs/") && request.url.endsWith("/log")) {
      state.logCount += 1;
      await readRequestBody(request);
      response.setHeader("content-type", "application/json");
      response.end(JSON.stringify({ ok: true }));
      return;
    }

    if (request.method === "POST" && request.url.includes("/api/runs/") && request.url.endsWith("/finish")) {
      const rawBody = await readRequestBody(request);
      const payload = JSON.parse(rawBody) as RunFinishPayload;
      state.finishPayloads.push(payload);
      response.setHeader("content-type", "application/json");
      response.end(JSON.stringify({ ok: true }));
      return;
    }

    response.statusCode = 404;
    response.end("not found");
  });

  await new Promise<void>((resolveServer) => {
    server.listen(0, "127.0.0.1", () => {
      resolveServer();
    });
  });

  const address = server.address();
  assert.ok(address && typeof address !== "string");

  return {
    url: `http://127.0.0.1:${address.port}`,
    state,
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

async function runCli(args: string[], timeoutMs = 12000): Promise<{ code: number | null; stdout: string; stderr: string }> {
  const cliEntryPath = getCliEntryPath();

  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(process.execPath, [cliEntryPath, ...args], {
      stdio: ["ignore", "pipe", "pipe"]
    });

    let stdout = "";
    let stderr = "";

    const timeoutHandle = setTimeout(() => {
      child.kill("SIGKILL");
      rejectRun(new Error(`CLI execution timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf-8");
    });

    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf-8");
    });

    child.on("error", (error) => {
      clearTimeout(timeoutHandle);
      rejectRun(error);
    });

    child.on("close", (code) => {
      clearTimeout(timeoutHandle);
      resolveRun({ code, stdout, stderr });
    });
  });
}

test("analyse emits json summary when --json-summary is enabled", async () => {
  const workspaceDir = createTempWorkspace();
  const targetPath = join(workspaceDir, "target");
  const server = await startMockServer();

  const phpstanBin = createMockPhpstanBinary(
    workspaceDir,
    "#!/usr/bin/env node\nconsole.log(JSON.stringify({ files: {} }));\nprocess.exit(0);\n"
  );

  try {
    const result = await runCli([
      "phpstan",
      "analyse",
      targetPath,
      "--server-url",
      server.url,
      "--phpstan-bin",
      phpstanBin,
      "--no-open",
      "--json-summary"
    ]);

    assert.equal(result.code, 0);
    assert.match(result.stdout, /\"event\":\"analyse-summary\"/);
    assert.equal(server.state.finishPayloads.length, 1);
    assert.equal(server.state.finishPayloads[0]?.exitCode, 0);
  } finally {
    await server.close();
    rmSync(workspaceDir, { recursive: true, force: true });
  }
});

test("analyse timeout returns exit code 124 and finishes run", async () => {
  const workspaceDir = createTempWorkspace();
  const targetPath = join(workspaceDir, "target");
  const server = await startMockServer();

  const phpstanBin = createMockPhpstanBinary(
    workspaceDir,
    "#!/usr/bin/env node\nsetTimeout(() => process.exit(0), 5000);\n"
  );

  try {
    const result = await runCli([
      "phpstan",
      "analyse",
      targetPath,
      "--server-url",
      server.url,
      "--phpstan-bin",
      phpstanBin,
      "--no-open",
      "--timeout-ms",
      "250"
    ]);

    assert.equal(result.code, 124);
    assert.match(result.stderr, /timeout/i);
    assert.equal(server.state.finishPayloads.length, 1);
    assert.equal(server.state.finishPayloads[0]?.exitCode, 124);
  } finally {
    await server.close();
    rmSync(workspaceDir, { recursive: true, force: true });
  }
});

test("watch emits watch-cycle summary and stops at max cycles", async () => {
  const workspaceDir = createTempWorkspace();
  const targetPath = join(workspaceDir, "target");
  const watchedFile = join(targetPath, "Sample.php");
  const server = await startMockServer();

  const phpstanBin = createMockPhpstanBinary(
    workspaceDir,
    "#!/usr/bin/env node\nconsole.log(JSON.stringify({ files: {} }));\nprocess.exit(0);\n"
  );

  try {
    const touchTimer = setTimeout(() => {
      writeFileSync(watchedFile, `<?php\n echo '${Date.now()}';\n`);
    }, 250);

    const result = await runCli([
      "phpstan",
      "analyse",
      targetPath,
      "--server-url",
      server.url,
      "--phpstan-bin",
      phpstanBin,
      "--no-open",
      "--watch",
      "--watch-no-initial",
      "--watch-interval",
      "100",
      "--watch-debounce",
      "50",
      "--watch-max-cycles",
      "1",
      "--json-summary"
    ], 12000);

    clearTimeout(touchTimer);

    assert.equal(result.code, 0);
    assert.match(result.stdout, /\"event\":\"watch-cycle\"/);
    assert.equal(server.state.finishPayloads.length, 1);
  } finally {
    await server.close();
    rmSync(workspaceDir, { recursive: true, force: true });
  }
});

test("rag ingest starts a job without waiting", async () => {
  const server = await startMockServer();

  try {
    const result = await runCli([
      "rag",
      "ingest",
      "--server-url",
      server.url,
      "--target-path",
      "/workspace/docs/rag"
    ]);

    assert.equal(result.code, 0);
    assert.match(result.stdout, /Ingest job queued:/);
    assert.equal(server.state.ingestCreateCount, 1);
    assert.equal(server.state.ingestGetCount, 0);
  } finally {
    await server.close();
  }
});

test("rag ingest --wait polls until completion", async () => {
  const server = await startMockServer();

  try {
    const result = await runCli([
      "rag",
      "ingest",
      "--server-url",
      server.url,
      "--wait",
      "--poll-interval-ms",
      "50"
    ]);

    assert.equal(result.code, 0);
    assert.match(result.stdout, /Ingest job completed:/);
    assert.match(result.stdout, /Ingest stats filesIndexed=3 chunksIndexed=10/);
    assert.equal(server.state.ingestCreateCount, 1);
    assert.ok(server.state.ingestGetCount >= 2);
  } finally {
    await server.close();
  }
});

test("rag ingest --list prints recent jobs", async () => {
  const server = await startMockServer();

  try {
    const result = await runCli([
      "rag",
      "ingest",
      "--server-url",
      server.url,
      "--list",
      "--limit",
      "2"
    ]);

    assert.equal(result.code, 0);
    assert.match(result.stdout, /job-3/);
    assert.match(result.stdout, /failed/);
    assert.equal(server.state.ingestListCount, 1);
    assert.equal(server.state.ingestCreateCount, 0);
  } finally {
    await server.close();
  }
});

test("rag ingest --list supports status filter", async () => {
  const server = await startMockServer();

  try {
    const result = await runCli([
      "rag",
      "ingest",
      "--server-url",
      server.url,
      "--list",
      "--status",
      "completed"
    ]);

    assert.equal(result.code, 0);
    assert.match(result.stdout, /completed/);
    assert.doesNotMatch(result.stdout, /failed/);
    assert.equal(server.state.ingestListCount, 1);
  } finally {
    await server.close();
  }
});

test("rag ingest --list rejects invalid status", async () => {
  const server = await startMockServer();

  try {
    const result = await runCli([
      "rag",
      "ingest",
      "--server-url",
      server.url,
      "--list",
      "--status",
      "invalid"
    ]);

    assert.equal(result.code, 1);
    assert.match(result.stderr, /--status must be one of/i);
    assert.equal(server.state.ingestListCount, 0);
  } finally {
    await server.close();
  }
});

test("analyse fails fast on unknown flag", async () => {
  const workspaceDir = createTempWorkspace();
  const targetPath = join(workspaceDir, "target");

  try {
    const result = await runCli([
      "phpstan",
      "analyse",
      targetPath,
      "--unknown-flag"
    ]);

    assert.equal(result.code, 1);
    assert.match(result.stderr, /Unknown flag/i);
  } finally {
    rmSync(workspaceDir, { recursive: true, force: true });
  }
});

test("analyse fails when a required flag value is missing", async () => {
  const workspaceDir = createTempWorkspace();
  const targetPath = join(workspaceDir, "target");

  try {
    const result = await runCli([
      "phpstan",
      "analyse",
      targetPath,
      "--port"
    ]);

    assert.equal(result.code, 1);
    assert.match(result.stderr, /requires a value/i);
  } finally {
    rmSync(workspaceDir, { recursive: true, force: true });
  }
});

test("analyse reports invalid target directory", async () => {
  const workspaceDir = createTempWorkspace();
  const server = await startMockServer();
  const missingPath = join(workspaceDir, "missing-target");

  const phpstanBin = createMockPhpstanBinary(
    workspaceDir,
    "#!/usr/bin/env node\nconsole.log(JSON.stringify({ files: {} }));\nprocess.exit(0);\n"
  );

  try {
    const result = await runCli([
      "phpstan",
      "analyse",
      missingPath,
      "--server-url",
      server.url,
      "--phpstan-bin",
      phpstanBin,
      "--no-open"
    ]);

    assert.equal(result.code, 1);
    assert.match(result.stderr, /Target path does not exist or cannot be accessed/i);
  } finally {
    await server.close();
    rmSync(workspaceDir, { recursive: true, force: true });
  }
});
