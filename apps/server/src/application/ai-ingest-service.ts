// This file implements asynchronous AI ingest job lifecycle management.

import { randomUUID } from "node:crypto";
import type { AiIngestJob, AiIngestJobRepository, AiIngestProgress } from "../ports/ai-ingest-job-repository.js";
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
      progress: createEmptyProgress(),
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
      const stats = await this.ingestProcessor.ingest(queuedJob.targetPath, async (progress) => {
        const runningJob = await this.jobRepository.findById(jobId);
        if (!runningJob || runningJob.status === "completed" || runningJob.status === "failed") {
          return;
        }

        await this.jobRepository.save({
          ...runningJob,
          status: "running",
          updatedAt: new Date().toISOString(),
          progress: normalizeProgress(progress)
        });
      });
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
        progress: normalizeProgress({
          ...runningJob.progress,
          filesProcessed: stats.filesIndexed,
          filesTotal: Math.max(runningJob.progress.filesTotal, stats.filesIndexed),
          chunksProcessed: stats.chunksIndexed,
          chunksTotal: Math.max(runningJob.progress.chunksTotal, stats.chunksIndexed),
          progressPercent: 100
        }),
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
        progress: normalizeProgress(runningJob.progress),
        stats: null
      });
    }
  }
}

function createEmptyProgress(): AiIngestProgress {
  return {
    filesProcessed: 0,
    filesTotal: 0,
    chunksProcessed: 0,
    chunksTotal: 0,
    progressPercent: 0
  };
}

function normalizeProgress(progress: AiIngestProgress): AiIngestProgress {
  const filesProcessed = Math.max(0, progress.filesProcessed);
  const filesTotal = Math.max(filesProcessed, progress.filesTotal);
  const chunksProcessed = Math.max(0, progress.chunksProcessed);
  const chunksTotal = Math.max(chunksProcessed, progress.chunksTotal);
  const derivedPercent = chunksTotal > 0
    ? Math.round((chunksProcessed / chunksTotal) * 100)
    : (filesTotal > 0 ? Math.round((filesProcessed / filesTotal) * 100) : progress.progressPercent);

  return {
    filesProcessed,
    filesTotal,
    chunksProcessed,
    chunksTotal,
    progressPercent: Math.min(100, Math.max(0, derivedPercent))
  };
}
