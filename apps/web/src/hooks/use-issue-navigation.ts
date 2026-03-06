// This hook centralizes issue navigation logic to keep App as orchestration-only.
import { useCallback } from "react";
import type { RunIssue } from "../types.js";
import { toRelativeRunPath } from "../utils/run-file-tree.js";

interface UseIssueNavigationOptions {
  issues: RunIssue[];
  selectedRunTargetPath: string | null;
  setSelectedIssueIndex: (value: number | ((current: number) => number)) => void;
  setSelectedFilePath: (value: string | null) => void;
}

interface UseIssueNavigationResult {
  selectIssueByIndex: (nextIndex: number) => void;
}

export function getBoundedIssueIndex(nextIndex: number, issuesLength: number): number {
  return Math.min(Math.max(nextIndex, 0), Math.max(issuesLength - 1, 0));
}

export function findFirstIssueIndexForFile(issues: RunIssue[], selectedRunTargetPath: string, filePath: string): number {
  const issuesForFile = issues
    .map((issue, issueIndex) => ({ issue, issueIndex }))
    .filter(({ issue }) => toRelativeRunPath(selectedRunTargetPath, issue.file) === filePath)
    .sort((left, right) => {
      if (left.issue.line === right.issue.line) {
        return left.issueIndex - right.issueIndex;
      }

      return left.issue.line - right.issue.line;
    });

  return issuesForFile[0]?.issueIndex ?? -1;
}

export function useIssueNavigation({
  issues,
  selectedRunTargetPath,
  setSelectedIssueIndex,
  setSelectedFilePath
}: UseIssueNavigationOptions): UseIssueNavigationResult {
  const selectIssueByIndex = useCallback((nextIndex: number) => {
    const boundedIndex = getBoundedIssueIndex(nextIndex, issues.length);

    setSelectedIssueIndex(boundedIndex);
    if (!selectedRunTargetPath) {
      return;
    }

    // Clear file override and align source view with selected issue context.
    setSelectedFilePath(null);
  }, [issues.length, selectedRunTargetPath, setSelectedFilePath, setSelectedIssueIndex]);

  return {
    selectIssueByIndex
  };
}
