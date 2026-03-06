// This file tests HTTP run start validations and happy path behavior.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHttpServer } from "./http-server.js";
import { AiExplainService } from "../application/ai-explain-service.js";
import { AiIngestService } from "../application/ai-ingest-service.js";
import { AiSuggestFixService } from "../application/ai-suggest-fix-service.js";
import { RunService } from "../application/run-service.js";
import { InMemoryAiIngestJobRepository } from "../infrastructure/in-memory-ai-ingest-job-repository.js";
import { NoopAiIngestProcessor } from "../infrastructure/noop-ai-ingest-processor.js";
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
  const aiIngestService = new AiIngestService(new InMemoryAiIngestJobRepository(), new NoopAiIngestProcessor());
  const aiExplainService = new AiExplainService(process.env.PHPSAGE_AI_PROVIDER?.trim() || "fallback");
  const aiSuggestFixService = new AiSuggestFixService(process.env.PHPSAGE_AI_PROVIDER?.trim() || "fallback");
  const server = createHttpServer(runService, runSourceReader, aiIngestService, aiExplainService, aiSuggestFixService);

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

async function startHealthProbeServer(statusCode: number = 200): Promise<{ url: string; close: () => Promise<void> }> {
  const server = createServer((_request: IncomingMessage, response: ServerResponse) => {
    response.statusCode = statusCode;
    response.end("ok");
  });

  await new Promise<void>((resolveStart) => {
    server.listen(0, "127.0.0.1", () => {
      resolveStart();
    });
  });

  const address = server.address();
  assert.ok(address && typeof address !== "string");

  return {
    url: `http://127.0.0.1:${address.port}`,
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

test("POST /api/ai/ingest creates ingest job and GET /api/ai/ingest/:jobId returns it", async () => {
  const httpServer = await startTestHttpServer();

  try {
    const createResponse = await fetch(`${httpServer.baseUrl}/api/ai/ingest`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ targetPath: "/workspace/examples/php-sample" })
    });

    assert.equal(createResponse.status, 202);
    const createdPayload = (await createResponse.json()) as {
      jobId: string;
      targetPath: string;
      status: string;
      createdAt: string;
      updatedAt: string;
      startedAt: string | null;
      finishedAt: string | null;
      error: string | null;
      stats: { filesIndexed: number; chunksIndexed: number } | null;
    };

    assert.ok(createdPayload.jobId.length > 0);
    assert.equal(createdPayload.targetPath, "/workspace/examples/php-sample");
    assert.match(createdPayload.status, /queued|running|completed/);
    assert.equal(createdPayload.error, null);

    const readResponse = await fetch(`${httpServer.baseUrl}/api/ai/ingest/${createdPayload.jobId}`);
    assert.equal(readResponse.status, 200);
    const readPayload = (await readResponse.json()) as {
      jobId: string;
      targetPath: string;
      status: string;
      stats: { filesIndexed: number; chunksIndexed: number } | null;
    };

    assert.equal(readPayload.jobId, createdPayload.jobId);
    assert.equal(readPayload.targetPath, "/workspace/examples/php-sample");
    assert.match(readPayload.status, /queued|running|completed/);
    if (readPayload.status === "completed") {
      assert.deepEqual(readPayload.stats, { filesIndexed: 0, chunksIndexed: 0 });
    }
  } finally {
    await httpServer.close();
  }
});

test("POST /api/ai/ingest uses default target when body targetPath is missing", async () => {
  const previousDefaultTarget = process.env.AI_INGEST_DEFAULT_TARGET;
  process.env.AI_INGEST_DEFAULT_TARGET = "/workspace/docs/phpstan";

  const httpServer = await startTestHttpServer();

  try {
    const response = await fetch(`${httpServer.baseUrl}/api/ai/ingest`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({})
    });

    assert.equal(response.status, 202);
    const payload = (await response.json()) as { targetPath: string };
    assert.equal(payload.targetPath, "/workspace/docs/phpstan");
  } finally {
    await httpServer.close();
    if (previousDefaultTarget === undefined) {
      delete process.env.AI_INGEST_DEFAULT_TARGET;
    } else {
      process.env.AI_INGEST_DEFAULT_TARGET = previousDefaultTarget;
    }
  }
});

test("GET /api/ai/ingest/:jobId returns 404 when job does not exist", async () => {
  const httpServer = await startTestHttpServer();

  try {
    const response = await fetch(`${httpServer.baseUrl}/api/ai/ingest/missing-job`);
    assert.equal(response.status, 404);
    const payload = (await response.json()) as { error: string };
    assert.match(payload.error, /Ingest job not found/i);
  } finally {
    await httpServer.close();
  }
});

test("GET /api/ai/ingest/latest returns most recent ingest job", async () => {
  const httpServer = await startTestHttpServer();

  try {
    await fetch(`${httpServer.baseUrl}/api/ai/ingest`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetPath: "/workspace/rag" })
    });

    const second = await fetch(`${httpServer.baseUrl}/api/ai/ingest`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetPath: "/workspace/examples/php-sample" })
    });
    assert.equal(second.status, 202);

    const latestResponse = await fetch(`${httpServer.baseUrl}/api/ai/ingest/latest`);
    assert.equal(latestResponse.status, 200);
    const payload = (await latestResponse.json()) as { targetPath: string };
    assert.equal(payload.targetPath, "/workspace/examples/php-sample");
  } finally {
    await httpServer.close();
  }
});

test("GET /api/ai/ingest returns recent ingest jobs with limit", async () => {
  const httpServer = await startTestHttpServer();

  try {
    await fetch(`${httpServer.baseUrl}/api/ai/ingest`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetPath: "/workspace/one" })
    });
    await fetch(`${httpServer.baseUrl}/api/ai/ingest`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetPath: "/workspace/two" })
    });
    await fetch(`${httpServer.baseUrl}/api/ai/ingest`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetPath: "/workspace/three" })
    });

    const response = await fetch(`${httpServer.baseUrl}/api/ai/ingest?limit=2`);
    assert.equal(response.status, 200);

    const payload = (await response.json()) as Array<{ targetPath: string }>;
    assert.equal(payload.length, 2);
    assert.equal(payload[0]?.targetPath, "/workspace/three");
    assert.equal(payload[1]?.targetPath, "/workspace/two");
  } finally {
    await httpServer.close();
  }
});

test("GET /api/ai/ingest filters jobs by status", async () => {
  const httpServer = await startTestHttpServer();

  try {
    await fetch(`${httpServer.baseUrl}/api/ai/ingest`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ targetPath: "/workspace/examples/php-sample" })
    });

    await fetch(`${httpServer.baseUrl}/api/ai/ingest`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ targetPath: "/workspace/non-existent-target" })
    });

    const failedResponse = await fetch(`${httpServer.baseUrl}/api/ai/ingest?status=failed&limit=10`);
    assert.equal(failedResponse.status, 200);

    const failedPayload = (await failedResponse.json()) as Array<{
      status: string;
      targetPath: string;
    }>;

    assert.ok(failedPayload.length >= 1);
    assert.ok(failedPayload.every((job) => job.status === "failed"));
    assert.equal(failedPayload[0].targetPath, "/workspace/non-existent-target");

    const completedResponse = await fetch(`${httpServer.baseUrl}/api/ai/ingest?status=completed&limit=10`);
    assert.equal(completedResponse.status, 200);
    const completedPayload = (await completedResponse.json()) as Array<{ status: string }>;
    assert.ok(completedPayload.every((job) => job.status === "completed"));
  } finally {
    await httpServer.close();
  }
});

test("GET /api/ai/ingest validates status filter", async () => {
  const httpServer = await startTestHttpServer();

  try {
    const response = await fetch(`${httpServer.baseUrl}/api/ai/ingest?status=unknown`);
    assert.equal(response.status, 400);

    const payload = (await response.json()) as { error: string };
    assert.match(payload.error, /status must be one of/i);
  } finally {
    await httpServer.close();
  }
});

test("POST /api/ai/explain validates missing issueMessage", async () => {
  const httpServer = await startTestHttpServer();

  try {
    const response = await fetch(`${httpServer.baseUrl}/api/ai/explain`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({})
    });

    assert.equal(response.status, 400);
    const payload = (await response.json()) as { error: string };
    assert.match(payload.error, /issueMessage is required/i);
  } finally {
    await httpServer.close();
  }
});

test("POST /api/ai/explain returns fallback explanation payload", async () => {
  const previousProvider = process.env.PHPSAGE_AI_PROVIDER;
  process.env.PHPSAGE_AI_PROVIDER = "openai";

  const httpServer = await startTestHttpServer();

  try {
    const response = await fetch(`${httpServer.baseUrl}/api/ai/explain`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        issueMessage: "Undefined variable: $foo",
        issueIdentifier: "variable.undefined",
        filePath: "src/Example.php",
        line: 12,
        sourceSnippet: "$bar = $foo;"
      })
    });

    assert.equal(response.status, 200);
    const payload = (await response.json()) as {
      explanation: string;
      recommendations: string[];
      source: string;
      provider: string;
      fallbackReason: string;
      usage: null;
      debug: {
        strategy: string;
      };
    };

    assert.match(payload.explanation, /Undefined variable: \$foo/);
    assert.equal(payload.source, "fallback");
    assert.equal(payload.provider, "openai");
    assert.match(payload.fallbackReason, /not configured/i);
    assert.equal(payload.usage, null);
    assert.equal(payload.debug.strategy, "fallback-explain");
    assert.ok(payload.recommendations.length >= 2);
  } finally {
    await httpServer.close();
    if (previousProvider === undefined) {
      delete process.env.PHPSAGE_AI_PROVIDER;
    } else {
      process.env.PHPSAGE_AI_PROVIDER = previousProvider;
    }
  }
});

test("POST /api/ai/suggest-fix validates missing issueMessage", async () => {
  const httpServer = await startTestHttpServer();

  try {
    const response = await fetch(`${httpServer.baseUrl}/api/ai/suggest-fix`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({})
    });

    assert.equal(response.status, 400);
    const payload = (await response.json()) as { error: string };
    assert.match(payload.error, /issueMessage is required/i);
  } finally {
    await httpServer.close();
  }
});

test("POST /api/ai/suggest-fix returns fallback payload without unsafe diff", async () => {
  const previousProvider = process.env.PHPSAGE_AI_PROVIDER;
  process.env.PHPSAGE_AI_PROVIDER = "openai";

  const httpServer = await startTestHttpServer();

  try {
    const response = await fetch(`${httpServer.baseUrl}/api/ai/suggest-fix`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        issueMessage: "Undefined variable: $undefinedVariable",
        issueIdentifier: "variable.undefined",
        filePath: "src/Broken.php",
        line: 7,
        sourceSnippet: "return $undefinedVariable + $value;"
      })
    });

    assert.equal(response.status, 200);
    const payload = (await response.json()) as {
      proposedDiff: string | null;
      rationale: string;
      source: string;
      provider: string;
      fallbackReason: string;
      rejectedReason: string | null;
      usage: null;
      debug: {
        strategy: string;
      };
    };

    assert.equal(payload.proposedDiff, null);
    assert.equal(payload.rejectedReason, null);
    assert.match(payload.rationale, /Unable to return a safe patch/i);
    assert.equal(payload.source, "fallback");
    assert.equal(payload.provider, "openai");
    assert.match(payload.fallbackReason, /not configured/i);
    assert.equal(payload.usage, null);
    assert.equal(payload.debug.strategy, "fallback-suggest-fix");
  } finally {
    await httpServer.close();
    if (previousProvider === undefined) {
      delete process.env.PHPSAGE_AI_PROVIDER;
    } else {
      process.env.PHPSAGE_AI_PROVIDER = previousProvider;
    }
  }
});

test("GET /api/ai/health returns disabled status when no provider is configured", async () => {
  const previousProvider = process.env.PHPSAGE_AI_PROVIDER;
  const previousModel = process.env.PHPSAGE_AI_MODEL;
  const previousOpenAiApiKey = process.env.OPENAI_API_KEY;
  const previousHealthTimeout = process.env.AI_HEALTH_TIMEOUT_MS;
  const previousOpenAiBaseUrl = process.env.OPENAI_BASE_URL;
  const previousOllamaBaseUrl = process.env.OLLAMA_BASE_URL;
  const previousQdrantUrl = process.env.QDRANT_URL;
  delete process.env.PHPSAGE_AI_PROVIDER;
  delete process.env.PHPSAGE_AI_MODEL;
  delete process.env.OPENAI_API_KEY;
  process.env.AI_HEALTH_TIMEOUT_MS = "50";
  process.env.OPENAI_BASE_URL = "http://127.0.0.1:9";
  process.env.OLLAMA_BASE_URL = "http://127.0.0.1:9";
  process.env.QDRANT_URL = "http://127.0.0.1:9";

  const httpServer = await startTestHttpServer();

  try {
    const response = await fetch(`${httpServer.baseUrl}/api/ai/health`);
    assert.equal(response.status, 200);
    const payload = (await response.json()) as {
      status: string;
      enabled: boolean;
      activeProvider: string | null;
      activeModel: string | null;
      timestamp: string;
      providers: Array<{
        provider: string;
        url: string;
        status: string;
        latencyMs: number;
        error: string | null;
      }>;
    };

    assert.equal(payload.status, "ok");
    assert.equal(payload.enabled, false);
    assert.equal(payload.activeProvider, null);
    assert.equal(payload.activeModel, null);
    assert.match(payload.timestamp, /T/);
    assert.equal(payload.providers.length, 3);
  } finally {
    await httpServer.close();
    if (previousProvider === undefined) {
      delete process.env.PHPSAGE_AI_PROVIDER;
    } else {
      process.env.PHPSAGE_AI_PROVIDER = previousProvider;
    }

    if (previousModel === undefined) {
      delete process.env.PHPSAGE_AI_MODEL;
    } else {
      process.env.PHPSAGE_AI_MODEL = previousModel;
    }

    if (previousOpenAiApiKey === undefined) {
      delete process.env.OPENAI_API_KEY;
    } else {
      process.env.OPENAI_API_KEY = previousOpenAiApiKey;
    }

    if (previousHealthTimeout === undefined) {
      delete process.env.AI_HEALTH_TIMEOUT_MS;
    } else {
      process.env.AI_HEALTH_TIMEOUT_MS = previousHealthTimeout;
    }

    if (previousOpenAiBaseUrl === undefined) {
      delete process.env.OPENAI_BASE_URL;
    } else {
      process.env.OPENAI_BASE_URL = previousOpenAiBaseUrl;
    }

    if (previousOllamaBaseUrl === undefined) {
      delete process.env.OLLAMA_BASE_URL;
    } else {
      process.env.OLLAMA_BASE_URL = previousOllamaBaseUrl;
    }

    if (previousQdrantUrl === undefined) {
      delete process.env.QDRANT_URL;
    } else {
      process.env.QDRANT_URL = previousQdrantUrl;
    }
  }
});

test("GET /api/ai/health returns enabled status with configured provider and model", async () => {
  const previousProvider = process.env.PHPSAGE_AI_PROVIDER;
  const previousModel = process.env.PHPSAGE_AI_MODEL;
  const previousOpenAiApiKey = process.env.OPENAI_API_KEY;
  const previousOpenAiHealthUrl = process.env.OPENAI_HEALTH_URL;
  const previousHealthTimeout = process.env.AI_HEALTH_TIMEOUT_MS;
  process.env.PHPSAGE_AI_PROVIDER = "openai";
  process.env.PHPSAGE_AI_MODEL = "gpt-5-mini";
  process.env.OPENAI_API_KEY = "test-key";
  process.env.AI_HEALTH_TIMEOUT_MS = "200";

  const healthProbeServer = await startHealthProbeServer(200);
  process.env.OPENAI_HEALTH_URL = `${healthProbeServer.url}/v1/models`;

  const httpServer = await startTestHttpServer();

  try {
    const response = await fetch(`${httpServer.baseUrl}/api/ai/health`);
    assert.equal(response.status, 200);
    const payload = (await response.json()) as {
      status: string;
      enabled: boolean;
      activeProvider: string | null;
      activeModel: string | null;
      providers: Array<{
        provider: string;
        status: string;
      }>;
    };

    assert.equal(payload.status, "ok");
    assert.equal(payload.enabled, true);
    assert.equal(payload.activeProvider, "openai");
    assert.equal(payload.activeModel, "gpt-5-mini");
    const openaiProbe = payload.providers.find((provider) => provider.provider === "openai");
    assert.equal(openaiProbe?.status, "up");
  } finally {
    await httpServer.close();
    await healthProbeServer.close();
    if (previousProvider === undefined) {
      delete process.env.PHPSAGE_AI_PROVIDER;
    } else {
      process.env.PHPSAGE_AI_PROVIDER = previousProvider;
    }

    if (previousModel === undefined) {
      delete process.env.PHPSAGE_AI_MODEL;
    } else {
      process.env.PHPSAGE_AI_MODEL = previousModel;
    }

    if (previousOpenAiApiKey === undefined) {
      delete process.env.OPENAI_API_KEY;
    } else {
      process.env.OPENAI_API_KEY = previousOpenAiApiKey;
    }

    if (previousOpenAiHealthUrl === undefined) {
      delete process.env.OPENAI_HEALTH_URL;
    } else {
      process.env.OPENAI_HEALTH_URL = previousOpenAiHealthUrl;
    }

    if (previousHealthTimeout === undefined) {
      delete process.env.AI_HEALTH_TIMEOUT_MS;
    } else {
      process.env.AI_HEALTH_TIMEOUT_MS = previousHealthTimeout;
    }
  }
});

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

test("GET /api/runs returns run summaries", async () => {
  const httpServer = await startTestHttpServer();
  const workspaceDir = mkdtempSync(join(tmpdir(), "phpsage-http-list-"));
  const targetA = join(workspaceDir, "project-a");
  const targetB = join(workspaceDir, "project-b");
  mkdirSync(targetA, { recursive: true });
  mkdirSync(targetB, { recursive: true });

  try {
    const runAStart = await fetch(`${httpServer.baseUrl}/api/runs/start`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ targetPath: targetA })
    });
    assert.equal(runAStart.status, 201);
    const runA = (await runAStart.json()) as { runId: string };

    const runBStart = await fetch(`${httpServer.baseUrl}/api/runs/start`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ targetPath: targetB })
    });
    assert.equal(runBStart.status, 201);
    const runB = (await runBStart.json()) as { runId: string };

    const runBFinish = await fetch(`${httpServer.baseUrl}/api/runs/${runB.runId}/finish`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        issues: [
          {
            file: "src/b.php",
            line: 2,
            message: "Example issue"
          }
        ],
        exitCode: 1
      })
    });
    assert.equal(runBFinish.status, 200);

    const listResponse = await fetch(`${httpServer.baseUrl}/api/runs`);
    assert.equal(listResponse.status, 200);
    const summaries = (await listResponse.json()) as Array<{
      runId: string;
      targetPath: string;
      status: string;
      exitCode: number | null;
      issueCount: number;
    }>;

    assert.equal(summaries.length, 2);
    const byId = new Map(summaries.map((summary) => [summary.runId, summary]));

    const summaryA = byId.get(runA.runId);
    assert.ok(summaryA);
    assert.equal(summaryA.targetPath, targetA);
    assert.equal(summaryA.status, "running");
    assert.equal(summaryA.exitCode, null);
    assert.equal(summaryA.issueCount, 0);

    const summaryB = byId.get(runB.runId);
    assert.ok(summaryB);
    assert.equal(summaryB.targetPath, targetB);
    assert.equal(summaryB.status, "finished");
    assert.equal(summaryB.exitCode, 1);
    assert.equal(summaryB.issueCount, 1);
  } finally {
    await httpServer.close();
    rmSync(workspaceDir, { recursive: true, force: true });
  }
});

test("GET /api/runs/:runId returns run details and 404 for missing run", async () => {
  const httpServer = await startTestHttpServer();
  const workspaceDir = mkdtempSync(join(tmpdir(), "phpsage-http-detail-"));
  const targetPath = join(workspaceDir, "project");
  mkdirSync(targetPath, { recursive: true });

  try {
    const notFoundResponse = await fetch(`${httpServer.baseUrl}/api/runs/missing`);
    assert.equal(notFoundResponse.status, 404);

    const startResponse = await fetch(`${httpServer.baseUrl}/api/runs/start`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ targetPath })
    });
    assert.equal(startResponse.status, 201);
    const startedRun = (await startResponse.json()) as { runId: string };

    const logResponse = await fetch(`${httpServer.baseUrl}/api/runs/${startedRun.runId}/log`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ stream: "stdout", message: "hello" })
    });
    assert.equal(logResponse.status, 200);

    const finishResponse = await fetch(`${httpServer.baseUrl}/api/runs/${startedRun.runId}/finish`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        issues: [
          {
            file: "src/file.php",
            line: 10,
            message: "Issue from detail test"
          }
        ],
        exitCode: 1
      })
    });
    assert.equal(finishResponse.status, 200);

    const detailResponse = await fetch(`${httpServer.baseUrl}/api/runs/${startedRun.runId}`);
    assert.equal(detailResponse.status, 200);
    const detail = (await detailResponse.json()) as RunRecord;

    assert.equal(detail.runId, startedRun.runId);
    assert.equal(detail.targetPath, targetPath);
    assert.equal(detail.status, "finished");
    assert.equal(detail.exitCode, 1);
    assert.equal(detail.logs.length, 1);
    assert.equal(detail.logs[0]?.stream, "stdout");
    assert.equal(detail.logs[0]?.message, "hello");
    assert.equal(detail.issues.length, 1);
    assert.equal(detail.issues[0]?.file, "src/file.php");
  } finally {
    await httpServer.close();
    rmSync(workspaceDir, { recursive: true, force: true });
  }
});
