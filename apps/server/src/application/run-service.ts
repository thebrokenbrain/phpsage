// This file contains run lifecycle use cases orchestrated by the API layer.
import { randomUUID } from "node:crypto";
import type { RunIssue, RunLogEntry, RunRecord, RunSummary } from "../domain/run.js";
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

  public async appendLog(runId: string, stream: "stdout" | "stderr", message: string): Promise<RunRecord | null> {
    const run = await this.runRepository.findById(runId);
    if (!run) {
      return null;
    }

    const nextLog: RunLogEntry = {
      timestamp: new Date().toISOString(),
      stream,
      message
    };

    const updated: RunRecord = {
      ...run,
      updatedAt: new Date().toISOString(),
      logs: [...run.logs, nextLog]
    };

    await this.runRepository.save(updated);
    return updated;
  }

  public async finish(runId: string, issues: RunIssue[], exitCode: number): Promise<RunRecord | null> {
    const run = await this.runRepository.findById(runId);
    if (!run) {
      return null;
    }

    const updated: RunRecord = {
      ...run,
      updatedAt: new Date().toISOString(),
      status: "finished",
      issues,
      exitCode
    };

    await this.runRepository.save(updated);
    return updated;
  }

  public async getById(runId: string): Promise<RunRecord | null> {
    return this.runRepository.findById(runId);
  }

  public async delete(runId: string): Promise<boolean> {
    return this.runRepository.deleteById(runId);
  }

  public async list(): Promise<RunSummary[]> {
    return this.runRepository.listSummaries();
  }

  public static isRunIssueList(value: unknown): value is RunIssue[] {
    if (!Array.isArray(value)) {
      return false;
    }

    return value.every((item) => {
      if (!item || typeof item !== "object") {
        return false;
      }

      const candidate = item as Record<string, unknown>;
      return (
        typeof candidate.file === "string" &&
        typeof candidate.line === "number" &&
        typeof candidate.message === "string" &&
        (candidate.identifier === undefined || typeof candidate.identifier === "string")
      );
    });
  }
}
