import type { AiLlmClient, AiLlmDebugPayload, AiLlmInput, AiLlmOutput } from "../ports/ai-llm-client.js";

interface OllamaGenerateResponse {
  readonly response?: string;
}

export class OllamaLlmClient implements AiLlmClient {
  public constructor(
    private readonly baseUrl: string,
    private readonly model: string,
    private readonly timeoutMs: number = 3500,
    private readonly debugLlmIoEnabled: boolean = false
  ) {}

  public async explain(input: AiLlmInput): Promise<AiLlmOutput> {
    return this.generate(this.toExplainPrompt(input));
  }

  public async suggestFix(input: AiLlmInput): Promise<AiLlmOutput> {
    return this.generate(this.toSuggestFixPrompt(input));
  }

  private async generate(prompt: string): Promise<AiLlmOutput> {
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      controller.abort();
    }, this.timeoutMs);

    try {
      const requestBody = {
        model: this.model,
        stream: false,
        prompt
      };

      const response = await fetch(`${this.baseUrl.replace(/\/+$/, "")}/api/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        signal: controller.signal,
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        throw new Error(`Ollama HTTP ${response.status}`);
      }

      const payload = (await response.json()) as OllamaGenerateResponse;
      const answer = payload.response?.trim() ?? "";
      if (!answer) {
        throw new Error("Ollama returned empty response");
      }

      return {
        text: answer,
        usage: {
          model: this.model,
          inputTokens: null,
          outputTokens: null,
          totalTokens: null
        },
        debug: this.buildDebugPayload("ollama-generate", "/api/generate", requestBody, payload, prompt)
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  private buildDebugPayload(
    strategy: string,
    endpoint: string,
    requestBody: Record<string, unknown>,
    rawResponse: unknown,
    prompt: string
  ): AiLlmDebugPayload | null {
    if (!this.debugLlmIoEnabled) {
      return null;
    }

    return {
      strategy,
      endpoint,
      prompt,
      requestBody,
      rawResponse
    };
  }

  private toExplainPrompt(input: AiLlmInput): string {
    const parts = [
      "You are PHPSage, explain this PHP static-analysis issue in concise plain English.",
      `Message: ${input.issueMessage}`,
      `Identifier: ${input.issueIdentifier ?? "unknown"}`,
      `File: ${input.filePath ?? "unknown"}`,
      `Line: ${input.line ?? 0}`
    ];

    if (input.sourceSnippet) {
      parts.push("Source snippet:");
      parts.push(input.sourceSnippet);
    }

    if (input.retrievedContext) {
      parts.push("Relevant PHPStan reference context:");
      parts.push(input.retrievedContext);
    }

    parts.push("Return 2 short actionable recommendations.");
    return parts.join("\n");
  }

  private toSuggestFixPrompt(input: AiLlmInput): string {
    const filePath = input.filePath ?? "unknown.php";
    const parts = [
      "You are PHPSage, propose a minimal unified diff patch for this PHP static-analysis issue.",
      "Output strictly a unified diff with headers and hunks. Do not output markdown fences.",
      `Message: ${input.issueMessage}`,
      `Identifier: ${input.issueIdentifier ?? "unknown"}`,
      `File: ${filePath}`,
      `Line: ${input.line ?? 0}`
    ];

    if (input.sourceSnippet) {
      parts.push("Source snippet:");
      parts.push(input.sourceSnippet);
    }

    if (input.retrievedContext) {
      parts.push("Relevant PHPStan reference context:");
      parts.push(input.retrievedContext);
    }

    parts.push(`Use these headers exactly: --- a/${filePath} and +++ b/${filePath}.`);
    return parts.join("\n");
  }
}
