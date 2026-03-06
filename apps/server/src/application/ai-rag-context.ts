// This module centralizes shared AI issue-context utilities used by explain/suggest services.

import type { AiRagContextItem, AiRagRetriever } from "../ports/ai-rag-retriever.js";

export interface AiIssueContextRequest {
  readonly issueMessage: string;
  readonly issueIdentifier?: string;
  readonly filePath?: string;
  readonly line?: number;
  readonly sourceSnippet?: string;
}

export function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function retrieveContextItemsSafely(
  ragRetriever: AiRagRetriever | undefined,
  request: AiIssueContextRequest,
  limit = 3
): Promise<AiRagContextItem[]> {
  if (!ragRetriever) {
    return [];
  }

  try {
    return await ragRetriever.retrieve({
      issueMessage: request.issueMessage,
      issueIdentifier: request.issueIdentifier,
      filePath: request.filePath,
      line: request.line,
      sourceSnippet: request.sourceSnippet,
      limit
    });
  } catch {
    return [];
  }
}

export function formatRetrievedContext(contextItems: AiRagContextItem[]): string | undefined {
  if (contextItems.length === 0) {
    return undefined;
  }

  return contextItems
    .map((item, index) => {
      const identifierPart = item.identifier ? `identifier=${item.identifier}` : "identifier=unknown";
      return `Context ${index + 1} (${identifierPart}, source=${item.sourcePath}, score=${item.score.toFixed(3)}):\n${item.content}`;
    })
    .join("\n\n");
}

export function summarizeContextSources(contextItems: AiRagContextItem[], maxItems = 2): string | null {
  if (contextItems.length === 0) {
    return null;
  }

  const summarized = contextItems
    .slice(0, Math.max(1, maxItems))
    .map((item) => item.sourcePath)
    .join(", ");

  return `Relevant references: ${summarized}.`;
}
