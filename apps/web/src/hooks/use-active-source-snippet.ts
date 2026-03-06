import { useMemo } from "react";
import type { SourcePayload } from "../types.js";

interface UseActiveSourceSnippetOptions {
  sourcePayload: SourcePayload | null;
  activeIssueLineInSource: number | null;
}

export function useActiveSourceSnippet({
  sourcePayload,
  activeIssueLineInSource
}: UseActiveSourceSnippetOptions): string | undefined {
  return useMemo(() => {
    if (!sourcePayload || !activeIssueLineInSource) {
      return undefined;
    }

    const sourceLines = sourcePayload.content.split("\n");
    return sourceLines[activeIssueLineInSource - 1]?.trim() || undefined;
  }, [activeIssueLineInSource, sourcePayload]);
}