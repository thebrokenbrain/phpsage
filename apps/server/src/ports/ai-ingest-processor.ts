// This file defines the processor port used to run ingest work.

import type { AiIngestProgress, AiIngestStats } from "./ai-ingest-job-repository.js";

export type AiIngestProgressReporter = (progress: AiIngestProgress) => Promise<void> | void;

export interface AiIngestProcessor {
  ingest(targetPath: string, reportProgress?: AiIngestProgressReporter): Promise<AiIngestStats>;
}
