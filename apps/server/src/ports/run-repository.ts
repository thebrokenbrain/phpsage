// This file declares storage operations required by run use cases.
import type { RunRecord, RunSummary } from "../domain/run.js";

export interface RunRepository {
  save(run: RunRecord): Promise<void>;
  findById(runId: string): Promise<RunRecord | null>;
  listSummaries(): Promise<RunSummary[]>;
}
