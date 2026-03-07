// This file tests filesystem run repository persistence and summary behavior.
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import assert from "node:assert/strict";
import { FileRunRepository } from "./file-run-repository.js";
import type { RunRecord } from "../domain/run.js";

function createRunRecord(overrides: Partial<RunRecord>): RunRecord {
  return {
    runId: "run-default",
    targetPath: "/workspace/examples/php-sample",
    createdAt: "2026-03-02T00:00:00.000Z",
    updatedAt: "2026-03-02T00:00:00.000Z",
    status: "finished",
    logs: [],
    issues: [],
    exitCode: 0,
    ...overrides
  };
}

test("saves and retrieves run by id", async () => {
  const directory = await mkdtemp(join(tmpdir(), "phpsage-run-repo-"));
  try {
    const repository = new FileRunRepository(directory);
    const run = createRunRecord({ runId: "run-1" });

    await repository.save(run);
    const found = await repository.findById("run-1");

    assert.ok(found);
    assert.equal(found?.runId, "run-1");
    assert.equal(found?.targetPath, "/workspace/examples/php-sample");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("lists summaries sorted by createdAt descending", async () => {
  const directory = await mkdtemp(join(tmpdir(), "phpsage-run-repo-"));
  try {
    const repository = new FileRunRepository(directory);
    await repository.save(createRunRecord({ runId: "run-old", createdAt: "2026-03-01T10:00:00.000Z", updatedAt: "2026-03-01T10:00:00.000Z" }));
    await repository.save(createRunRecord({ runId: "run-new", createdAt: "2026-03-02T10:00:00.000Z", updatedAt: "2026-03-02T10:00:00.000Z", issues: [{ file: "a.php", line: 1, message: "x" }] }));

    const summaries = await repository.listSummaries();
    assert.equal(summaries.length, 2);
    assert.equal(summaries[0].runId, "run-new");
    assert.equal(summaries[0].issueCount, 1);
    assert.equal(summaries[1].runId, "run-old");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("deletes existing run files and returns false for missing run", async () => {
  const directory = await mkdtemp(join(tmpdir(), "phpsage-run-repo-"));
  try {
    const repository = new FileRunRepository(directory);
    await repository.save(createRunRecord({ runId: "run-delete" }));

    const deleted = await repository.deleteById("run-delete");
    const missingDeleted = await repository.deleteById("run-delete");
    const found = await repository.findById("run-delete");

    assert.equal(deleted, true);
    assert.equal(missingDeleted, false);
    assert.equal(found, null);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
