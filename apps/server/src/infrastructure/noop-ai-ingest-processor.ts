// This file provides a deterministic placeholder ingest processor for phase parity.

import type { AiIngestProcessor } from "../ports/ai-ingest-processor.js";
import type { AiIngestStats } from "../ports/ai-ingest-job-repository.js";

export class NoopAiIngestProcessor implements AiIngestProcessor {
  public async ingest(_targetPath: string): Promise<AiIngestStats> {
    return {
      filesIndexed: 0,
      chunksIndexed: 0
    };
  }
}
