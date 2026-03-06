// This file provides the explain use case with deterministic fallback output.

import type { AiRagContextItem, AiRagRetriever } from "../ports/ai-rag-retriever.js";
import { retrieveContextItemsSafely } from "./ai-rag-context.js";

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
  readonly source: "fallback";
  readonly provider: string;
  readonly fallbackReason: string;
  readonly contextItems: AiRagContextItem[];
  readonly usage: null;
  readonly debug: null;
}

export class AiExplainService {
  public constructor(
    private readonly providerName: string = "fallback",
    private readonly ragRetriever?: AiRagRetriever
  ) {}

  public async explain(request: AiExplainRequest): Promise<AiExplainResponse> {
    const contextItems = await retrieveContextItemsSafely(this.ragRetriever, request);

    return {
      explanation: this.buildFallbackExplanation(request),
      recommendations: this.defaultRecommendations(request.issueIdentifier),
      source: "fallback",
      provider: this.providerName,
      fallbackReason: "LLM provider is not configured for explain yet",
      contextItems,
      usage: null,
      debug: null
    };
  }

  private buildFallbackExplanation(request: AiExplainRequest): string {
    const identifier = request.issueIdentifier ?? "unknown";
    const location = request.filePath && request.line ? `${request.filePath}:${request.line}` : "the reported location";

    return [
      `PHPStan reported '${request.issueMessage}' (${identifier}) at ${location}.`,
      "This usually indicates a mismatch between the inferred type/scope and the value that the code expects.",
      "Review initialization order, nullability guards, and method contracts near the failing line."
    ].join(" ");
  }

  private defaultRecommendations(identifier?: string): string[] {
    if (identifier === "variable.undefined") {
      return [
        "Initialize the variable before first read, or guard access with a condition.",
        "Pass required values explicitly through function parameters instead of implicit scope."
      ];
    }

    return [
      "Verify the referenced symbol/type exists in the current scope and matches expected contracts.",
      "Add explicit type checks or guard clauses before the failing operation."
    ];
  }
}
