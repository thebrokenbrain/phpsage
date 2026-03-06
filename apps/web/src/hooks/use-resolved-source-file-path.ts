import { useMemo } from "react";
import type { RunRecord } from "../types.js";

interface UseResolvedSourceFilePathOptions {
  selectedRunId: string | null;
  selectedRun: RunRecord | null;
  selectedSourceFilePath: string | null;
  activeIssueFile: string | undefined;
}

export function useResolvedSourceFilePath({
  selectedRunId,
  selectedRun,
  selectedSourceFilePath,
  activeIssueFile
}: UseResolvedSourceFilePathOptions): string | null {
  return useMemo(() => {
    if (!selectedRunId || !selectedRun) {
      return null;
    }

    if (selectedSourceFilePath) {
      return selectedSourceFilePath;
    }

    return activeIssueFile ?? null;
  }, [activeIssueFile, selectedRun, selectedRunId, selectedSourceFilePath]);
}