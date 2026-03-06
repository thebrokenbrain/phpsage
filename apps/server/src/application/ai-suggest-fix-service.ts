// This file provides suggest-fix use case with deterministic fallback output.

import type { AiRagContextItem, AiRagRetriever } from "../ports/ai-rag-retriever.js";
import type { AiLlmClient, AiLlmDebugPayload, AiLlmUsage } from "../ports/ai-llm-client.js";
import type { AiPatchGuard } from "../ports/ai-patch-guard.js";
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
  readonly source: "fallback" | "llm";
  readonly provider: string;
  readonly fallbackReason: string | null;
  readonly contextItems: AiRagContextItem[];
  readonly usage: AiLlmUsage | null;
  readonly debug: AiLlmDebugPayload | null;
}

export class AiSuggestFixService {
  public constructor(
    private readonly providerName: string = "fallback",
    private readonly ragRetriever?: AiRagRetriever,
    private readonly ragTopK: number = 3,
    private readonly llmClient?: AiLlmClient,
    private readonly patchGuard?: AiPatchGuard
  ) {}

  public async suggestFix(request: AiSuggestFixRequest): Promise<AiSuggestFixResponse> {
    const contextItems = await retrieveContextItemsSafely(this.ragRetriever, request, this.ragTopK);

    if (this.llmClient) {
      try {
        const output = await this.llmClient.suggestFix({
          issueMessage: request.issueMessage,
          issueIdentifier: request.issueIdentifier,
          filePath: request.filePath,
          line: request.line,
          sourceSnippet: request.sourceSnippet,
          retrievedContext: contextItems.map((item) => item.content).join("\n\n")
        });
        const parsed = this.parseSuggestFixOutput(output.text);

        if (this.patchGuard) {
          const guardResult = await this.patchGuard.validate({
            filePath: request.filePath,
            proposedDiff: parsed.proposedDiff
          });

          if (!guardResult.accepted) {
            throw new Error(`Patch rejected by guardrails: ${guardResult.rejectedReason ?? "unknown reason"}`);
          }
        }

        return {
          proposedDiff: parsed.proposedDiff,
          rationale: parsed.rationale,
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

    return this.buildFallbackResponse(request, contextItems, "LLM provider is not configured for suggest-fix yet");
  }

  private buildFallbackResponse(
    request: AiSuggestFixRequest,
    contextItems: AiRagContextItem[],
    fallbackReason: string
  ): AiSuggestFixResponse {
    return {
      proposedDiff: this.buildFallbackDiff(request),
      rationale: this.buildRationale(request, contextItems),
      source: "fallback",
      provider: this.providerName,
      fallbackReason,
      contextItems,
      usage: null,
      debug: null
    };
  }

  private parseSuggestFixOutput(text: string): { proposedDiff: string; rationale: string } {
    const trimmed = text.trim();
    if (!trimmed.startsWith("{")) {
      return {
        proposedDiff: trimmed,
        rationale: "LLM proposed a direct unified diff response."
      };
    }

    const parsed = JSON.parse(trimmed) as { proposedDiff?: string; rationale?: string };
    const proposedDiff = typeof parsed.proposedDiff === "string" ? parsed.proposedDiff.trim() : "";
    const rationale = typeof parsed.rationale === "string" ? parsed.rationale.trim() : "LLM proposed fix.";

    if (!proposedDiff) {
      throw new Error("LLM suggest-fix payload missing proposedDiff");
    }

    return {
      proposedDiff,
      rationale
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