export interface RunSummary {
  readonly runId: string;
  readonly targetPath: string;
  readonly status: "running" | "finished";
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly exitCode: number | null;
  readonly issueCount: number;
}

export interface RunIssue {
  readonly file: string;
  readonly line: number;
  readonly message: string;
  readonly identifier?: string;
}

export interface RunLogEntry {
  readonly timestamp: string;
  readonly stream: "stdout" | "stderr";
  readonly message: string;
}

export interface RunRecord extends RunSummary {
  readonly logs: RunLogEntry[];
  readonly issues: RunIssue[];
}

export interface RunFileItem {
  readonly path: string;
  readonly issueCount: number;
  readonly hasIssues: boolean;
}

export interface RunFilesPayload {
  readonly targetPath: string;
  readonly files: RunFileItem[];
}

export interface SourcePayload {
  readonly file: string;
  readonly content: string;
}

export interface AiHealthPayload {
  readonly status: "ok";
  readonly enabled: boolean;
  readonly activeProvider: string | null;
  readonly activeModel: string | null;
}

export interface AiExplainPayload {
  readonly explanation: string;
  readonly recommendations: string[];
  readonly source: "fallback";
  readonly provider: string;
  readonly fallbackReason: string;
  readonly usage: null;
  readonly debug: null;
}

export interface AiSuggestFixPayload {
  readonly proposedDiff: string;
  readonly rationale: string;
  readonly source: "fallback";
  readonly provider: string;
  readonly fallbackReason: string;
  readonly usage: null;
  readonly debug: null;
}

export interface StartRunPayload {
  readonly runId: string;
  readonly targetPath: string;
  readonly status: "running" | "finished";
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly exitCode: number | null;
  readonly issueCount: number;
}

export type ViewMode = "dashboard" | "insights" | "issue";
