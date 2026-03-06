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
  readonly proposedDiff: string | null;
  readonly rationale: string;
  readonly source: "fallback" | "llm";
  readonly provider: string;
  readonly fallbackReason: string | null;
  readonly rejectedReason: string | null;
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
          rejectedReason: null,
          contextItems,
          usage: output.usage,
          debug: output.debug
        };
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        const rejectedReason = this.extractRejectedReason(reason);
        return this.buildFallbackResponse(request, contextItems, `LLM request failed: ${reason}`, rejectedReason);
      }
    }

    return this.buildFallbackResponse(request, contextItems, "LLM provider is not configured for suggest-fix yet", null);
  }

  private buildFallbackResponse(
    request: AiSuggestFixRequest,
    contextItems: AiRagContextItem[],
    fallbackReason: string,
    rejectedReason: string | null
  ): AiSuggestFixResponse {
    return {
      proposedDiff: null,
      rationale: this.buildRationale(request, contextItems),
      source: "fallback",
      provider: this.providerName,
      fallbackReason,
      rejectedReason,
      contextItems,
      usage: null,
      debug: this.buildFallbackDebugPayload(request, contextItems, fallbackReason, rejectedReason)
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

  private buildRationale(request: AiSuggestFixRequest, contextItems: AiRagContextItem[]): string {
    const identifier = request.issueIdentifier ?? "unknown";
    const contextSummary = summarizeContextSources(contextItems);
    const base = `Unable to return a safe patch for issue '${request.issueMessage}' (${identifier}) because the generated diff did not pass validation.`;
    return contextSummary ? `${base} ${contextSummary}` : base;
  }

  private extractRejectedReason(reason: string): string | null {
    const marker = "Patch rejected by guardrails:";
    if (!reason.includes(marker)) {
      return null;
    }

    return reason.split(marker)[1]?.trim() || "Patch was rejected by guardrails";
  }

  private buildFallbackDebugPayload(
    request: AiSuggestFixRequest,
    contextItems: AiRagContextItem[],
    fallbackReason: string,
    rejectedReason: string | null
  ): AiLlmDebugPayload {
    return {
      strategy: "fallback-suggest-fix",
      endpoint: "local-fallback",
      prompt: [
        `Message: ${request.issueMessage}`,
        `Identifier: ${request.issueIdentifier ?? "unknown"}`,
        `File: ${request.filePath ?? "unknown"}`,
        `Line: ${request.line ?? 0}`,
        request.sourceSnippet ? `Source snippet:\n${request.sourceSnippet}` : "",
        contextItems.length > 0 ? "Context included from RAG retriever." : "No RAG context available."
      ].filter(Boolean).join("\n"),
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
        fallbackReason,
        rejectedReason
      }
    };
  }
}