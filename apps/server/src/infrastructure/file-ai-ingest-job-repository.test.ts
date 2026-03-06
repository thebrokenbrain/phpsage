// This file tests persistence for AI ingest jobs repository.

import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { FileAiIngestJobRepository } from "./file-ai-ingest-job-repository.js";
import type { AiIngestJob } from "../ports/ai-ingest-job-repository.js";

function createJob(overrides: Partial<AiIngestJob>): AiIngestJob {
  return {
    jobId: "job-default",
    targetPath: "/workspace/examples/php-sample",
    status: "queued",
    createdAt: "2026-03-01T00:00:00.000Z",
    updatedAt: "2026-03-01T00:00:00.000Z",
    startedAt: null,
    finishedAt: null,
    error: null,
    stats: null,
    ...overrides
  };
}

test("saves and retrieves ingest job by id", async () => {
  const directory = await mkdtemp(join(tmpdir(), "phpsage-ai-ingest-jobs-"));

  try {
    const repository = new FileAiIngestJobRepository(directory);
    const job = createJob({ jobId: "job-1", status: "completed", stats: { filesIndexed: 3, chunksIndexed: 8 } });

    await repository.save(job);
    const found = await repository.findById("job-1");

    assert.ok(found);
    assert.equal(found?.jobId, "job-1");
    assert.equal(found?.status, "completed");
    assert.deepEqual(found?.stats, { filesIndexed: 3, chunksIndexed: 8 });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("returns null when ingest job does not exist", async () => {
  const directory = await mkdtemp(join(tmpdir(), "phpsage-ai-ingest-jobs-"));

  try {
    const repository = new FileAiIngestJobRepository(directory);
    const found = await repository.findById("missing-job");
    assert.equal(found, null);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
