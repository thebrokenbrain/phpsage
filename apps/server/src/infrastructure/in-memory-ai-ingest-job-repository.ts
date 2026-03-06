// This file provides an in-memory repository for ingest jobs.

import type { AiIngestJob, AiIngestJobRepository } from "../ports/ai-ingest-job-repository.js";

export class InMemoryAiIngestJobRepository implements AiIngestJobRepository {
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
