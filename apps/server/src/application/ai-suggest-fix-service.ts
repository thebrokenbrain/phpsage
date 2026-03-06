// This file provides suggest-fix use case with deterministic fallback output.

import type { AiRagContextItem, AiRagRetriever } from "../ports/ai-rag-retriever.js";
import { retrieveContextItemsSafely, summarizeContextSources } from "./ai-rag-context.js";

export interface AiSuggestFixRequest {
  readonly issueMessage: string;
  readonly issueIdentifier?: string;
  readonly filePath?: string;
  readonly line?: number;
  readonly sourceSnippet?: string;
}

export interface AiSuggestFixResponse {
  readonly proposedDiff: string;
  readonly rationale: string;
  readonly source: "fallback";
  readonly provider: string;
  readonly fallbackReason: string;
  readonly contextItems: AiRagContextItem[];
  readonly usage: null;
  readonly debug: null;
}

export class AiSuggestFixService {
  public constructor(
    private readonly providerName: string = "fallback",
    private readonly ragRetriever?: AiRagRetriever,
    private readonly ragTopK: number = 3
  ) {}

  public async suggestFix(request: AiSuggestFixRequest): Promise<AiSuggestFixResponse> {
    const contextItems = await retrieveContextItemsSafely(this.ragRetriever, request, this.ragTopK);

    return {
      proposedDiff: this.buildFallbackDiff(request),
      rationale: this.buildRationale(request, contextItems),
      source: "fallback",
      provider: this.providerName,
      fallbackReason: "LLM provider is not configured for suggest-fix yet",
      contextItems,
      usage: null,
      debug: null
    };
  }

  private buildFallbackDiff(request: AiSuggestFixRequest): string {
    const filePath = this.normalizeDiffPath(request.filePath ?? "unknown.php");
    const line = request.line && request.line > 0 ? request.line : 1;
    const originalLine = request.sourceSnippet?.trim() || "// original code not available";
    const fixedLine = this.fallbackReplacementLine(request.issueIdentifier, originalLine);

    return [
      `--- a/${filePath}`,
      `+++ b/${filePath}`,
      `@@ -${line},1 +${line},1 @@`,
      `-${originalLine}`,
      `+${fixedLine}`
    ].join("\n");
  }

  private normalizeDiffPath(filePath: string): string {
    return filePath.replace(/^\/+/, "");
  }

  private fallbackReplacementLine(identifier: string | undefined, originalLine: string): string {
    if (identifier === "variable.undefined") {
      return originalLine.replace("$undefinedVariable", "$value");
    }

    return `${originalLine} // TODO: adjust code to satisfy static analysis`;
  }

  private buildRationale(request: AiSuggestFixRequest, contextItems: AiRagContextItem[]): string {
    const identifier = request.issueIdentifier ?? "unknown";
    const contextSummary = summarizeContextSources(contextItems);
    const base = `Suggested patch targets issue '${request.issueMessage}' (${identifier}) and keeps changes minimal by touching only the reported line context.`;
    return contextSummary ? `${base} ${contextSummary}` : base;
  }
}