// This file implements asynchronous AI ingest job lifecycle management.

import { randomUUID } from "node:crypto";
import type { AiIngestJob, AiIngestJobRepository } from "../ports/ai-ingest-job-repository.js";
import type { AiIngestProcessor } from "../ports/ai-ingest-processor.js";

export class AiIngestService {
  private latestJobId: string | null = null;

  public constructor(
    private readonly jobRepository: AiIngestJobRepository,
    private readonly ingestProcessor: AiIngestProcessor
  ) {}

  public async start(targetPath: string): Promise<AiIngestJob> {
    const now = new Date().toISOString();
    const job: AiIngestJob = {
      jobId: randomUUID(),
      targetPath,
      status: "queued",
      createdAt: now,
      updatedAt: now,
      startedAt: null,
      finishedAt: null,
      error: null,
      stats: null
    };

    await this.jobRepository.save(job);
    this.latestJobId = job.jobId;
    void this.execute(job.jobId);
    return job;
  }

  public async getById(jobId: string): Promise<AiIngestJob | null> {
    return this.jobRepository.findById(jobId);
  }

  public async getLatest(): Promise<AiIngestJob | null> {
    if (this.latestJobId) {
      return this.jobRepository.findById(this.latestJobId);
    }

    const recentJobs = await this.jobRepository.listRecent(1);
    return recentJobs[0] ?? null;
  }

  public async listRecent(limit: number): Promise<AiIngestJob[]> {
    return this.jobRepository.listRecent(limit);
  }

  private async execute(jobId: string): Promise<void> {
    const queuedJob = await this.jobRepository.findById(jobId);
    if (!queuedJob) {
      return;
    }

    const startedAt = new Date().toISOString();
    await this.jobRepository.save({
      ...queuedJob,
      status: "running",
      updatedAt: startedAt,
      startedAt
    });

    try {
      const stats = await this.ingestProcessor.ingest(queuedJob.targetPath);
      const finishedAt = new Date().toISOString();
      const runningJob = await this.jobRepository.findById(jobId);
      if (!runningJob) {
        return;
      }

      await this.jobRepository.save({
        ...runningJob,
        status: "completed",
        updatedAt: finishedAt,
        finishedAt,
        error: null,
        stats
      });
    } catch (error) {
      const finishedAt = new Date().toISOString();
      const runningJob = await this.jobRepository.findById(jobId);
      if (!runningJob) {
        return;
      }

      await this.jobRepository.save({
        ...runningJob,
        status: "failed",
        updatedAt: finishedAt,
        finishedAt,
        error: error instanceof Error ? error.message : String(error),
        stats: null
      });
    }
  }
}
