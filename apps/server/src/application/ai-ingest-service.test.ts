// This file tests ingest job lifecycle transitions for the AI ingest use case.

import assert from "node:assert/strict";
import { test } from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { AiIngestService } from "./ai-ingest-service.js";
import type { AiIngestProcessor, AiIngestProgressReporter } from "../ports/ai-ingest-processor.js";
import type { AiIngestJob, AiIngestJobRepository, AiIngestStats } from "../ports/ai-ingest-job-repository.js";

class InMemoryAiIngestJobRepository implements AiIngestJobRepository {
  private readonly jobs = new Map<string, AiIngestJob>();

  public async save(job: AiIngestJob): Promise<void> {
    this.jobs.set(job.jobId, job);
  }

  public async findById(jobId: string): Promise<AiIngestJob | null> {
    return this.jobs.get(jobId) ?? null;
  }

  public async listRecent(limit: number): Promise<AiIngestJob[]> {
    return Array.from(this.jobs.values())
      .sort((left, right) => (left.createdAt < right.createdAt ? 1 : -1))
      .slice(0, Math.max(1, limit));
  }
}

class SuccessProcessor implements AiIngestProcessor {
  public async ingest(_targetPath: string): Promise<AiIngestStats> {
    await delay(5);
    return {
      filesIndexed: 2,
      chunksIndexed: 7
    };
  }
}

class FailingProcessor implements AiIngestProcessor {
  public async ingest(_targetPath: string): Promise<AiIngestStats> {
    await delay(5);
    throw new Error("ingest failed");
  }
}

class ProgressProcessor implements AiIngestProcessor {
  public async ingest(_targetPath: string, reportProgress?: AiIngestProgressReporter): Promise<AiIngestStats> {
    await reportProgress?.({
      filesProcessed: 0,
      filesTotal: 2,
      chunksProcessed: 1,
      chunksTotal: 4,
      progressPercent: 25
    });
    await delay(5);
    await reportProgress?.({
      filesProcessed: 1,
      filesTotal: 2,
      chunksProcessed: 3,
      chunksTotal: 4,
      progressPercent: 75
    });
    await delay(5);

    return {
      filesIndexed: 2,
      chunksIndexed: 4
    };
  }
}

async function waitForStatus(
  service: AiIngestService,
  jobId: string,
  expectedStatus: "completed" | "failed"
): Promise<AiIngestJob> {
  for (let index = 0; index < 30; index += 1) {
    const current = await service.getById(jobId);
    if (current && current.status === expectedStatus) {
      return current;
    }

    await delay(5);
  }

  throw new Error(`job ${jobId} did not reach status ${expectedStatus}`);
}

test("AiIngestService marks job as completed and stores stats", async () => {
  const service = new AiIngestService(new InMemoryAiIngestJobRepository(), new SuccessProcessor());

  const job = await service.start("/workspace/examples/php-sample");
  assert.equal(job.status, "queued");

  const completed = await waitForStatus(service, job.jobId, "completed");
  assert.equal(completed.targetPath, "/workspace/examples/php-sample");
  assert.equal(completed.error, null);
  assert.ok(completed.startedAt);
  assert.ok(completed.finishedAt);
  assert.equal(completed.progress.progressPercent, 100);
  assert.deepEqual(completed.stats, { filesIndexed: 2, chunksIndexed: 7 });
});

test("AiIngestService marks job as failed when processor throws", async () => {
  const service = new AiIngestService(new InMemoryAiIngestJobRepository(), new FailingProcessor());

  const job = await service.start("/workspace/examples/php-sample");
  const failed = await waitForStatus(service, job.jobId, "failed");

  assert.equal(failed.stats, null);
  assert.match(failed.error ?? "", /ingest failed/);
  assert.ok(failed.finishedAt);
});

test("AiIngestService stores reported progress while job is running", async () => {
  const service = new AiIngestService(new InMemoryAiIngestJobRepository(), new ProgressProcessor());

  const job = await service.start("/workspace/docs/phpstan");

  for (let index = 0; index < 30; index += 1) {
    const current = await service.getById(job.jobId);
    if (current && current.progress.progressPercent >= 25) {
      assert.equal(current.progress.filesTotal, 2);
      assert.equal(current.progress.chunksTotal, 4);
      break;
    }

    await delay(5);
  }

  const completed = await waitForStatus(service, job.jobId, "completed");
  assert.equal(completed.progress.progressPercent, 100);
  assert.equal(completed.progress.chunksProcessed, 4);
});

test("AiIngestService exposes latest started job", async () => {
  const service = new AiIngestService(new InMemoryAiIngestJobRepository(), new SuccessProcessor());

  const first = await service.start("/workspace/rag");
  const second = await service.start("/workspace/examples/php-sample");

  assert.notEqual(first.jobId, second.jobId);

  const latest = await service.getLatest();
  assert.ok(latest);
  assert.equal(latest?.jobId, second.jobId);
});

test("AiIngestService lists recent jobs by recency", async () => {
  const service = new AiIngestService(new InMemoryAiIngestJobRepository(), new SuccessProcessor());

  await service.start("/workspace/first");
  await delay(2);
  await service.start("/workspace/second");
  await delay(2);
  await service.start("/workspace/third");

  const recent = await service.listRecent(2);
  assert.equal(recent.length, 2);
  assert.equal(recent[0]?.targetPath, "/workspace/third");
  assert.equal(recent[1]?.targetPath, "/workspace/second");
});
