// This file tests run service helpers used for payload validation.
import { test } from "node:test";
import assert from "node:assert/strict";
import { RunService } from "./run-service.js";
import type { RunRecord, RunSummary } from "../domain/run.js";
import type { RunRepository } from "../ports/run-repository.js";

test("accepts valid run issue list", () => {
  const value = [
    {
      file: "/workspace/examples/php-sample/src/Broken.php",
      line: 7,
      message: "Undefined variable",
      identifier: "variable.undefined"
    }
  ];

  assert.equal(RunService.isRunIssueList(value), true);
});

test("rejects invalid run issue payloads", () => {
  assert.equal(RunService.isRunIssueList(null), false);
  assert.equal(RunService.isRunIssueList({}), false);
  assert.equal(
    RunService.isRunIssueList([
      {
        file: "/workspace/examples/php-sample/src/Broken.php",
        line: "7",
        message: "Undefined variable"
      }
    ]),
    false
  );
});

test("appends log entries to existing run", async () => {
  const now = "2026-03-02T00:00:00.000Z";
  const run: RunRecord = {
    runId: "run-append-log",
    targetPath: "/workspace/examples/php-sample",
    createdAt: now,
    updatedAt: now,
    status: "running",
    logs: [],
    issues: [],
    exitCode: null
  };

  const repository = new InMemoryRunRepository([run]);
  const service = new RunService(repository);

  const updated = await service.appendLog(run.runId, "stdout", "hello log");
  assert.ok(updated);
  assert.equal(updated?.logs.length, 1);
  assert.equal(updated?.logs[0].message, "hello log");
});

class InMemoryRunRepository implements RunRepository {
  private readonly runs = new Map<string, RunRecord>();

  public constructor(initialRuns: RunRecord[]) {
    for (const run of initialRuns) {
      this.runs.set(run.runId, run);
    }
  }

  public async save(run: RunRecord): Promise<void> {
    this.runs.set(run.runId, run);
  }

  public async deleteById(runId: string): Promise<boolean> {
    return this.runs.delete(runId);
  }

  public async findById(runId: string): Promise<RunRecord | null> {
    return this.runs.get(runId) ?? null;
  }

  public async listSummaries(): Promise<RunSummary[]> {
    return [];
  }
}
