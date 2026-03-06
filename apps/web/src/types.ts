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

export interface RunRecord {
  readonly runId: string;
  readonly targetPath: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly status: "running" | "finished";
  readonly logs: Array<{
    readonly timestamp: string;
    readonly stream: "stdout" | "stderr";
    readonly message: string;
  }>;
  readonly issues: RunIssue[];
  readonly exitCode: number | null;
}

export interface RunFileEntry {
  readonly path: string;
  readonly issueCount: number;
  readonly hasIssues: boolean;
}

export interface RunFilesResponse {
  readonly targetPath: string;
  readonly files: RunFileEntry[];
}

export interface AiHealthResponse {
  readonly status: "ok" | "degraded";
  readonly timestamp: string;
  readonly activeProvider: string;
  readonly activeModel: string;
  readonly providers: Array<{
    readonly provider: string;
    readonly url: string;
    readonly status: "up" | "down";
    readonly latencyMs: number;
    readonly error?: string;
  }>;
}

export interface AiUsage {
  readonly model: string;
  readonly inputTokens: number | null;
  readonly outputTokens: number | null;
  readonly totalTokens: number | null;
}

export interface AiLlmDebugPayload {
  readonly strategy: string;
  readonly endpoint: string;
  readonly prompt: string;
  readonly systemPrompt?: string;
  readonly userPrompt?: string;
  readonly requestBody: Record<string, unknown>;
  readonly rawResponse: unknown;
}

export interface AiExplainResponse {
  readonly explanation: string;
  readonly recommendations: string[];
  readonly source: "llm" | "fallback";
  readonly provider: string;
  readonly fallbackReason: string | null;
  readonly usage: AiUsage | null;
  readonly debug: AiLlmDebugPayload | null;
}

export interface AiSuggestFixResponse {
  readonly proposedDiff: string | null;
  readonly rationale: string;
  readonly source: "llm" | "fallback";
  readonly provider: string;
  readonly fallbackReason: string | null;
  readonly rejectedReason: string | null;
  readonly usage: AiUsage | null;
  readonly debug: AiLlmDebugPayload | null;
}

export type ViewMode = "dashboard" | "insights" | "issue";
