// This file persists run records into local JSON files under data/runs.
import { mkdir, readdir, readFile, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { RunRecord, RunSummary } from "../domain/run.js";
import { toRunSummary } from "../domain/run.js";
import type { RunRepository } from "../ports/run-repository.js";

export class FileRunRepository implements RunRepository {
  public constructor(private readonly runsDirectoryPath: string) {}

  public async save(run: RunRecord): Promise<void> {
    await mkdir(this.runsDirectoryPath, { recursive: true });
    const filePath = this.getRunFilePath(run.runId);
    await writeFile(filePath, `${JSON.stringify(run, null, 2)}\n`, "utf-8");
  }

  public async deleteById(runId: string): Promise<boolean> {
    const filePath = this.getRunFilePath(runId);

    try {
      await unlink(filePath);
      return true;
    } catch (error) {
      if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
        return false;
      }

      throw error;
    }
  }

  public async findById(runId: string): Promise<RunRecord | null> {
    const filePath = this.getRunFilePath(runId);

    try {
      const content = await readFile(filePath, "utf-8");
      return JSON.parse(content) as RunRecord;
    } catch {
      return null;
    }
  }

  public async listSummaries(): Promise<RunSummary[]> {
    await mkdir(this.runsDirectoryPath, { recursive: true });
    const entries = await readdir(this.runsDirectoryPath);
    const runFiles = entries.filter((entry) => entry.endsWith(".json"));

    const runs = await Promise.all(
      runFiles.map(async (fileName) => {
        const content = await readFile(join(this.runsDirectoryPath, fileName), "utf-8");
        return JSON.parse(content) as RunRecord;
      })
    );

    return runs
      .map((run) => toRunSummary(run))
      .sort((left, right) => (left.createdAt < right.createdAt ? 1 : -1));
  }

  private getRunFilePath(runId: string): string {
    return join(this.runsDirectoryPath, `${runId}.json`);
  }
}
