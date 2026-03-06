// This file persists AI ingest jobs as JSON files on disk.

import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { AiIngestJob, AiIngestJobRepository } from "../ports/ai-ingest-job-repository.js";

export class FileAiIngestJobRepository implements AiIngestJobRepository {
  public constructor(private readonly jobsDirectoryPath: string) {}

  public async save(job: AiIngestJob): Promise<void> {
    await mkdir(this.jobsDirectoryPath, { recursive: true });
    await writeFile(this.getJobFilePath(job.jobId), `${JSON.stringify(job, null, 2)}\n`, "utf-8");
  }

  public async findById(jobId: string): Promise<AiIngestJob | null> {
    try {
      const content = await readFile(this.getJobFilePath(jobId), "utf-8");
      return JSON.parse(content) as AiIngestJob;
    } catch {
      return null;
    }
  }

  public async listRecent(limit: number): Promise<AiIngestJob[]> {
    await mkdir(this.jobsDirectoryPath, { recursive: true });
    const entries = await readdir(this.jobsDirectoryPath);
    const jobFiles = entries.filter((entry) => entry.endsWith(".json"));

    const jobs = await Promise.all(
      jobFiles.map(async (fileName) => {
        const content = await readFile(join(this.jobsDirectoryPath, fileName), "utf-8");
        return JSON.parse(content) as AiIngestJob;
      })
    );

    return jobs
      .sort((left, right) => (left.createdAt < right.createdAt ? 1 : -1))
      .slice(0, Math.max(1, limit));
  }

  private getJobFilePath(jobId: string): string {
    return join(this.jobsDirectoryPath, `${jobId}.json`);
  }
}
