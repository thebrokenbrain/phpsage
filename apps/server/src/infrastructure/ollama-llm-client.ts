import type { AiLlmClient, AiLlmDebugPayload, AiLlmInput, AiLlmOutput } from "../ports/ai-llm-client.js";

interface OllamaGenerateResponse {
  readonly response?: string;
}

interface PromptBundle {
  readonly systemPrompt: string;
  readonly userPrompt: string;
  readonly prompt: string;
}

export class OllamaLlmClient implements AiLlmClient {
  public constructor(
    private readonly baseUrl: string,
    private readonly model: string,
    private readonly timeoutMs: number = 3500,
    private readonly debugLlmIoEnabled: boolean = false
  ) {}

  public async explain(input: AiLlmInput): Promise<AiLlmOutput> {
    return this.generate(this.toExplainPromptBundle(input));
  }

  public async suggestFix(input: AiLlmInput): Promise<AiLlmOutput> {
    return this.generate(this.toSuggestFixPromptBundle(input));
  }

  private async generate(promptBundle: PromptBundle): Promise<AiLlmOutput> {
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      controller.abort();
    }, this.timeoutMs);

    try {
      const requestBody = {
        model: this.model,
        stream: false,
        system: promptBundle.systemPrompt,
        prompt: promptBundle.userPrompt
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
        debug: this.buildDebugPayload("ollama-generate", "/api/generate", requestBody, payload, promptBundle)
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
    promptBundle: PromptBundle
  ): AiLlmDebugPayload | null {
    if (!this.debugLlmIoEnabled) {
      return null;
    }

    return {
      strategy,
      endpoint,
      prompt: promptBundle.prompt,
      systemPrompt: promptBundle.systemPrompt,
      userPrompt: promptBundle.userPrompt,
      requestBody,
      rawResponse
    };
  }

  private toExplainPromptBundle(input: AiLlmInput): PromptBundle {
    const systemPrompt = "You are PHPSage. Explain PHP static-analysis issues in concise plain English.";
    const userPromptParts = [
      `Message: ${input.issueMessage}`,
      `Identifier: ${input.issueIdentifier ?? "unknown"}`,
      `File: ${input.filePath ?? "unknown"}`,
      `Line: ${input.line ?? 0}`
    ];

    if (input.sourceSnippet) {
      userPromptParts.push("Source snippet:");
      userPromptParts.push(input.sourceSnippet);
    }

    if (input.retrievedContext) {
      userPromptParts.push("Relevant PHPStan reference context:");
      userPromptParts.push(input.retrievedContext);
    }

    userPromptParts.push("Return 2 short actionable recommendations.");
    const userPrompt = userPromptParts.join("\n");
    return {
      systemPrompt,
      userPrompt,
      prompt: `${systemPrompt}\n\n${userPrompt}`
    };
  }

  private toSuggestFixPromptBundle(input: AiLlmInput): PromptBundle {
    const filePath = input.filePath ?? "unknown.php";
    const systemPrompt = "You are PHPSage. Propose minimal and safe unified diff patches for PHP static-analysis issues.";
    const userPromptParts = [
      "Output strictly a unified diff with headers and hunks. Do not output markdown fences.",
      `Message: ${input.issueMessage}`,
      `Identifier: ${input.issueIdentifier ?? "unknown"}`,
      `File: ${filePath}`,
      `Line: ${input.line ?? 0}`
    ];

    if (input.sourceSnippet) {
      userPromptParts.push("Source snippet:");
      userPromptParts.push(input.sourceSnippet);
    }

    if (input.retrievedContext) {
      userPromptParts.push("Relevant PHPStan reference context:");
      userPromptParts.push(input.retrievedContext);
    }

    userPromptParts.push(`Use these headers exactly: --- a/${filePath} and +++ b/${filePath}.`);
    const userPrompt = userPromptParts.join("\n");
    return {
      systemPrompt,
      userPrompt,
      prompt: `${systemPrompt}\n\n${userPrompt}`
    };
  }
}
