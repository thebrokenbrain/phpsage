import { useMemo } from "react";
import type { RunIssue, SourcePayload } from "../types.js";

interface UseActiveIssueLineInSourceOptions {
  sourcePayload: SourcePayload | null;
  activeIssue: RunIssue | null;
}

export function useActiveIssueLineInSource({ sourcePayload, activeIssue }: UseActiveIssueLineInSourceOptions): number | null {
  return useMemo(() => {
    if (!sourcePayload || !activeIssue) {
      return null;
    }

    if (activeIssue.file !== sourcePayload.file) {
      return null;
    }

    return activeIssue.line;
  }, [activeIssue, sourcePayload]);
}