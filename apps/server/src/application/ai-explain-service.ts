// This file provides the explain use case with deterministic fallback output.

import type { AiRagContextItem, AiRagRetriever } from "../ports/ai-rag-retriever.js";
import type { AiLlmClient, AiLlmDebugPayload, AiLlmUsage } from "../ports/ai-llm-client.js";
import { retrieveContextItemsSafely, summarizeContextSources } from "./ai-rag-context.js";

export interface AiExplainRequest {
  readonly issueMessage: string;
  readonly issueIdentifier?: string;
  readonly filePath?: string;
  readonly line?: number;
  readonly sourceSnippet?: string;
}

export interface AiExplainResponse {
  readonly explanation: string;
  readonly recommendations: string[];
  readonly source: "fallback" | "llm";
  readonly provider: string;
  readonly fallbackReason: string | null;
  readonly contextItems: AiRagContextItem[];
  readonly usage: AiLlmUsage | null;
  readonly debug: AiLlmDebugPayload | null;
}

export class AiExplainService {
  public constructor(
    private readonly providerName: string = "fallback",
    private readonly ragRetriever?: AiRagRetriever,
    private readonly ragTopK: number = 3,
    private readonly llmClient?: AiLlmClient
  ) {}

  public async explain(request: AiExplainRequest): Promise<AiExplainResponse> {
    const contextItems = await retrieveContextItemsSafely(this.ragRetriever, request, this.ragTopK);

    if (this.llmClient) {
      try {
        const output = await this.llmClient.explain({
          issueMessage: request.issueMessage,
          issueIdentifier: request.issueIdentifier,
          filePath: request.filePath,
          line: request.line,
          sourceSnippet: request.sourceSnippet,
          retrievedContext: contextItems.map((item) => item.content).join("\n\n")
        });
        const parsedOutput = this.parseExplainOutput(output.text);

        return {
          explanation: parsedOutput.explanation,
          recommendations: parsedOutput.recommendations,
          source: "llm",
          provider: this.providerName,
          fallbackReason: null,
          contextItems,
          usage: output.usage,
          debug: output.debug
        };
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        return this.buildFallbackResponse(request, contextItems, `LLM request failed: ${reason}`);
      }
    }

    return this.buildFallbackResponse(request, contextItems, "LLM provider is not configured for explain yet");
  }

  private buildFallbackResponse(request: AiExplainRequest, contextItems: AiRagContextItem[], fallbackReason: string): AiExplainResponse {
    return {
      explanation: this.buildFallbackExplanation(request, contextItems),
      recommendations: this.defaultRecommendations(request.issueIdentifier, contextItems),
      source: "fallback",
      provider: this.providerName,
      fallbackReason,
      contextItems,
      usage: null,
      debug: this.buildFallbackDebugPayload(request, contextItems, fallbackReason)
    };
  }

  private buildFallbackDebugPayload(
    request: AiExplainRequest,
    contextItems: AiRagContextItem[],
    fallbackReason: string
  ): AiLlmDebugPayload {
    const systemPrompt = "You are PHPSage. Explain PHP static analysis issues briefly and clearly.";
    const userPrompt = [
      `Message: ${request.issueMessage}`,
      `Identifier: ${request.issueIdentifier ?? "unknown"}`,
      `File: ${request.filePath ?? "unknown"}`,
      `Line: ${request.line ?? 0}`,
      request.sourceSnippet ? `Source snippet:\n${request.sourceSnippet}` : "",
      contextItems.length > 0 ? "Context included from RAG retriever." : "No RAG context available."
    ].filter(Boolean).join("\n");

    return {
      strategy: "fallback-explain",
      endpoint: "local-fallback",
      prompt: `${systemPrompt}\n\n${userPrompt}`,
      systemPrompt,
      userPrompt,
      requestBody: {
        issueMessage: request.issueMessage,
        issueIdentifier: request.issueIdentifier ?? null,
        filePath: request.filePath ?? null,
        line: request.line ?? null,
        sourceSnippet: request.sourceSnippet ?? null,
        contextItems: contextItems.map((item) => ({
          sourcePath: item.sourcePath,
          identifier: item.identifier,
          score: item.score
        }))
      },
      rawResponse: {
        fallbackReason
      }
    };
  }

  private parseExplainOutput(text: string): { explanation: string; recommendations: string[] } {
    const normalizedText = text.replace(/\r\n/g, "\n").replace(/\\n/g, "\n").trim();
    const recommendations = this.extractRecommendations(normalizedText);
    const explanation = normalizedText
      .split("\n")
      .filter((line) => !line.trim().startsWith("- "))
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    if (explanation.length > 0) {
      return {
        explanation,
        recommendations
      };
    }

    return {
      explanation: recommendations.length > 0 ? "Suggested actions for this issue are listed below." : normalizedText,
      recommendations
    };
  }

  private extractRecommendations(text: string): string[] {
    const lines = text
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.startsWith("- "))
      .map((line) => line.replace(/^-\s*/, ""));

    if (lines.length > 0) {
      return lines.slice(0, 3);
    }

    return [
      "Review variable initialization and nullability around the reported line.",
      "Align inferred and declared types to match method contracts."
    ];
  }

  private buildFallbackExplanation(request: AiExplainRequest, contextItems: AiRagContextItem[]): string {
    const identifier = request.issueIdentifier ?? "unknown";
    const location = request.filePath && request.line ? `${request.filePath}:${request.line}` : "the reported location";
    const contextSummary = summarizeContextSources(contextItems);

    const parts = [
      `PHPStan reported '${request.issueMessage}' (${identifier}) at ${location}.`,
      "This usually indicates a mismatch between the inferred type/scope and the value that the code expects.",
      "Review initialization order, nullability guards, and method contracts near the failing line."
    ];

    if (contextSummary) {
      parts.push(contextSummary);
    }

    return parts.join(" ");
  }

  private defaultRecommendations(identifier: string | undefined, contextItems: AiRagContextItem[]): string[] {
    const contextSummary = summarizeContextSources(contextItems, 1);

    if (identifier === "variable.undefined") {
      const recommendations = [
        "Initialize the variable before first read, or guard access with a condition.",
        "Pass required values explicitly through function parameters instead of implicit scope."
      ];

      if (contextSummary) {
        recommendations.push(`Cross-check against documentation. ${contextSummary}`);
      }

      return recommendations;
    }

    const recommendations = [
      "Verify the referenced symbol/type exists in the current scope and matches expected contracts.",
      "Add explicit type checks or guard clauses before the failing operation."
    ];

    if (contextSummary) {
      recommendations.push(`Use retrieved context as implementation reference. ${contextSummary}`);
    }

    return recommendations;
  }
}
