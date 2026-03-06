// This file defines ingest job contracts used by the AI ingest use case.

export type AiIngestJobStatus = "queued" | "running" | "completed" | "failed";

export interface AiIngestStats {
  readonly filesIndexed: number;
  readonly chunksIndexed: number;
}

export interface AiIngestJob {
  readonly jobId: string;
  readonly targetPath: string;
  readonly status: AiIngestJobStatus;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly startedAt: string | null;
  readonly finishedAt: string | null;
  readonly error: string | null;
  readonly stats: AiIngestStats | null;
}

export interface AiIngestJobRepository {
  save(job: AiIngestJob): Promise<void>;
  findById(jobId: string): Promise<AiIngestJob | null>;
}
