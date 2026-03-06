import { useMemo } from "react";
import type { RunIssue, RunRecord } from "../types.js";

interface UseFilteredIssueEntriesOptions {
  selectedRun: RunRecord | null;
  issueSearchTerm: string;
  issueIdentifierFilter: "all" | "with" | "without";
}

export function useFilteredIssueEntries({
  selectedRun,
  issueSearchTerm,
  issueIdentifierFilter
}: UseFilteredIssueEntriesOptions): Array<{ issue: RunIssue; absoluteIndex: number }> {
  return useMemo(() => {
    if (!selectedRun) {
      return [];
    }

    const normalizedSearchTerm = issueSearchTerm.trim().toLowerCase();

    return selectedRun.issues
      .map((issue, absoluteIndex) => ({ issue, absoluteIndex }))
      .filter(({ issue }) => {
        if (issueIdentifierFilter === "with" && !issue.identifier) {
          return false;
        }

        if (issueIdentifierFilter === "without" && issue.identifier) {
          return false;
        }

        if (normalizedSearchTerm.length === 0) {
          return true;
        }

        return `${issue.file}:${issue.line} ${issue.message}`.toLowerCase().includes(normalizedSearchTerm);
      });
  }, [issueIdentifierFilter, issueSearchTerm, selectedRun]);
}