import type { AiLlmClient, AiLlmDebugPayload, AiLlmInput, AiLlmOutput, AiLlmUsage } from "../ports/ai-llm-client.js";

interface OpenAiChatResponse {
  readonly choices?: Array<{
    readonly message?: {
      readonly content?: string;
    };
  }>;
  readonly usage?: {
    readonly prompt_tokens?: number;
    readonly completion_tokens?: number;
    readonly total_tokens?: number;
  };
}

interface OpenAiResponsesResponse {
  readonly output_text?: string;
  readonly output?: Array<{
    readonly content?: Array<{
      readonly type?: string;
      readonly text?: string;
    }>;
  }>;
  readonly usage?: {
    readonly input_tokens?: number;
    readonly output_tokens?: number;
    readonly total_tokens?: number;
  };
}

export class OpenAiLlmClient implements AiLlmClient {
  public constructor(
    private readonly baseUrl: string,
    private readonly apiKey: string,
    private readonly model: string,
    private readonly timeoutMs: number = 5000,
    private readonly debugLlmIoEnabled: boolean = false
  ) {}

  public async explain(input: AiLlmInput): Promise<AiLlmOutput> {
    return this.generate(this.toExplainPrompt(input));
  }

  public async suggestFix(input: AiLlmInput): Promise<AiLlmOutput> {
    return this.generate(this.toSuggestFixPrompt(input));
  }

  private async generate(prompt: string): Promise<AiLlmOutput> {
    if (!this.apiKey || this.apiKey.trim().length === 0) {
      throw new Error("OPENAI_API_KEY is required");
    }

    try {
      return await this.generateWithResponsesApi(prompt);
    } catch (error) {
      if (!this.shouldFallbackToChatCompletions(error)) {
        throw error;
      }

      return this.generateWithChatCompletions(prompt);
    }
  }

  private async generateWithResponsesApi(prompt: string): Promise<AiLlmOutput> {
    const requestBody = {
      model: this.model,
      input: prompt
    };
    const payload = await this.postJson<OpenAiResponsesResponse>("/v1/responses", requestBody);

    const answerFromOutputText = payload.output_text?.trim() ?? "";
    if (answerFromOutputText.length > 0) {
      return {
        text: answerFromOutputText,
        usage: this.buildUsageFromResponses(payload),
        debug: this.buildDebugPayload("responses", "/v1/responses", requestBody, payload, prompt)
      };
    }

    const answerFromContent = payload.output
      ?.flatMap((item) => item.content ?? [])
      .filter((item) => item.type === "output_text" || item.type === "text")
      .map((item) => item.text?.trim() ?? "")
      .filter((text) => text.length > 0)
      .join("\n") ?? "";

    if (!answerFromContent) {
      throw new Error("OpenAI Responses API returned empty response");
    }

    return {
      text: answerFromContent,
      usage: this.buildUsageFromResponses(payload),
      debug: this.buildDebugPayload("responses", "/v1/responses", requestBody, payload, prompt)
    };
  }

  private async generateWithChatCompletions(prompt: string): Promise<AiLlmOutput> {
    const requestBody = {
      model: this.model,
      messages: [
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.1
    };

    const payload = await this.postJson<OpenAiChatResponse>("/v1/chat/completions", requestBody);
    const answer = payload.choices?.[0]?.message?.content?.trim() ?? "";
    if (!answer) {
      throw new Error("OpenAI chat-completions returned empty response");
    }

    return {
      text: answer,
      usage: this.buildUsageFromChat(payload),
      debug: this.buildDebugPayload("chat-completions", "/v1/chat/completions", requestBody, payload, prompt)
    };
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

  private async postJson<TResponse>(path: string, body: Record<string, unknown>): Promise<TResponse> {
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      controller.abort();
    }, this.timeoutMs);

    try {
      const response = await fetch(`${this.baseUrl.replace(/\/+$/, "")}${path}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`
        },
        signal: controller.signal,
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenAI HTTP ${response.status}: ${errorText}`);
      }

      return (await response.json()) as TResponse;
    } finally {
      clearTimeout(timeout);
    }
  }

  private shouldFallbackToChatCompletions(error: unknown): boolean {
    if (!(error instanceof Error)) {
      return false;
    }

    const message = error.message.toLowerCase();
    if (!message.includes("openai http")) {
      return false;
    }

    return message.includes("http 400") || message.includes("http 404") || message.includes("http 405");
  }

  private buildUsageFromResponses(payload: OpenAiResponsesResponse): AiLlmUsage | null {
    return this.buildUsage(
      payload.usage?.input_tokens ?? null,
      payload.usage?.output_tokens ?? null,
      payload.usage?.total_tokens ?? null
    );
  }

  private buildUsageFromChat(payload: OpenAiChatResponse): AiLlmUsage | null {
    return this.buildUsage(
      payload.usage?.prompt_tokens ?? null,
      payload.usage?.completion_tokens ?? null,
      payload.usage?.total_tokens ?? null
    );
  }

  private buildUsage(inputTokens: number | null, outputTokens: number | null, totalTokens: number | null): AiLlmUsage | null {
    if (inputTokens === null && outputTokens === null && totalTokens === null) {
      return null;
    }

    return {
      model: this.model,
      inputTokens,
      outputTokens,
      totalTokens
    };
  }

  private toExplainPrompt(input: AiLlmInput): string {
    const lines = [
      "You are PHPSage. Explain this PHP static analysis issue briefly and clearly.",
      `Message: ${input.issueMessage}`,
      `Identifier: ${input.issueIdentifier ?? "unknown"}`,
      `File: ${input.filePath ?? "unknown"}`,
      `Line: ${input.line ?? 0}`,
      "Return plain text with two recommendations prefixed by '- '."
    ];

    if (input.sourceSnippet) {
      lines.push("Source snippet:");
      lines.push(input.sourceSnippet);
    }

    if (input.retrievedContext) {
      lines.push("Retrieved context:");
      lines.push(input.retrievedContext);
    }

    return lines.join("\n");
  }

  private toSuggestFixPrompt(input: AiLlmInput): string {
    const filePath = input.filePath ?? "unknown.php";
    const lines = [
      "You are PHPSage. Propose a minimal unified diff patch for this PHP static analysis issue.",
      "Return valid JSON only with shape: {\"proposedDiff\":\"...\",\"rationale\":\"...\"}.",
      "The proposedDiff must be a unified diff with headers and one hunk.",
      `Message: ${input.issueMessage}`,
      `Identifier: ${input.issueIdentifier ?? "unknown"}`,
      `File: ${filePath}`,
      `Line: ${input.line ?? 0}`,
      `Use headers exactly: --- a/${filePath} and +++ b/${filePath}`
    ];

    if (input.sourceSnippet) {
      lines.push("Source snippet:");
      lines.push(input.sourceSnippet);
    }

    if (input.retrievedContext) {
      lines.push("Retrieved context:");
      lines.push(input.retrievedContext);
    }

    return lines.join("\n");
  }
}
