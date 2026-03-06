// This file persists AI ingest jobs as JSON files on disk.

import { mkdir, readFile, writeFile } from "node:fs/promises";
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

  private getJobFilePath(jobId: string): string {
    return join(this.jobsDirectoryPath, `${jobId}.json`);
  }
}
