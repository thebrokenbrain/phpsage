// This file defines the processor port used to run ingest work.

import type { AiIngestStats } from "./ai-ingest-job-repository.js";

export interface AiIngestProcessor {
  ingest(targetPath: string): Promise<AiIngestStats>;
}
