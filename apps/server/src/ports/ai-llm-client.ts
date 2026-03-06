export interface AiLlmInput {
  readonly issueMessage: string;
  readonly issueIdentifier?: string;
  readonly filePath?: string;
  readonly line?: number;
  readonly sourceSnippet?: string;
  readonly retrievedContext?: string;
}

export interface AiLlmUsage {
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

export interface AiLlmOutput {
  readonly text: string;
  readonly usage: AiLlmUsage | null;
  readonly debug: AiLlmDebugPayload | null;
}

export interface AiLlmClient {
  explain(input: AiLlmInput): Promise<AiLlmOutput>;
  suggestFix(input: AiLlmInput): Promise<AiLlmOutput>;
}
