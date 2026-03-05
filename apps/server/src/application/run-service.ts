// This file contains run lifecycle use cases orchestrated by the API layer.
import { randomUUID } from "node:crypto";
import type { RunRecord } from "../domain/run.js";
import type { RunRepository } from "../ports/run-repository.js";

export class RunService {
  public constructor(private readonly runRepository: RunRepository) {}

  public async start(targetPath: string): Promise<RunRecord> {
    const now = new Date().toISOString();
    const run: RunRecord = {
      runId: randomUUID(),
      targetPath,
      createdAt: now,
      updatedAt: now,
      status: "running",
      logs: [],
      issues: [],
      exitCode: null
    };

    await this.runRepository.save(run);
    return run;
  }
}
