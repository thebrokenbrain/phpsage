// This file defines core run domain contracts for the server lifecycle.
export type RunStatus = "running" | "finished";

export interface RunLogEntry {
  readonly timestamp: string;
  readonly stream: "stdout" | "stderr";
  readonly message: string;
}

export interface RunIssue {
  readonly file: string;
  readonly line: number;
  readonly message: string;
  readonly identifier?: string;
}

export interface RunRecord {
  readonly runId: string;
  readonly targetPath: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly status: RunStatus;
  readonly logs: RunLogEntry[];
  readonly issues: RunIssue[];
  readonly exitCode: number | null;
}

export interface RunSummary {
  readonly runId: string;
  readonly targetPath: string;
  readonly status: RunStatus;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly exitCode: number | null;
  readonly issueCount: number;
}

export function toRunSummary(run: RunRecord): RunSummary {
  return {
    runId: run.runId,
    targetPath: run.targetPath,
    status: run.status,
    createdAt: run.createdAt,
    updatedAt: run.updatedAt,
    exitCode: run.exitCode,
    issueCount: run.issues.length
  };
}
