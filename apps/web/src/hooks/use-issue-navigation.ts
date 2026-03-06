// This hook centralizes issue/file navigation logic to keep App as orchestration-only.
import { useCallback, useEffect, type MutableRefObject } from "react";
import type { RunIssue } from "../types.js";
import { toRelativeRunPath } from "../utils/run-file-tree.js";
import { getIssueKey } from "../utils/app-helpers.js";
import type { FileIssueViewItem } from "../components/code-window.js";

interface UseIssueNavigationOptions {
  issues: RunIssue[];
  selectedRunTargetPath: string | null;
  selectedIssueKeyRef: MutableRefObject<string | null>;
  setSelectedIssueIndex: (value: number | ((current: number) => number)) => void;
  setSelectedFilePath: (value: string | null) => void;
}

interface UseIssueNavigationResult {
  selectIssueByIndex: (nextIndex: number) => void;
  handleSelectFile: (filePath: string) => void;
  handleSelectIssueInFile: (issueIndex: number) => void;
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
  selectedIssueKeyRef,
  setSelectedIssueIndex,
  setSelectedFilePath
}: UseIssueNavigationOptions): UseIssueNavigationResult {
  const selectIssueByIndex = useCallback((nextIndex: number) => {
    const boundedIndex = getBoundedIssueIndex(nextIndex, issues.length);
    const nextIssue = issues[boundedIndex] ?? null;
    const nextIssueKey = nextIssue ? getIssueKey(nextIssue) : null;

    setSelectedIssueIndex(boundedIndex);
    selectedIssueKeyRef.current = nextIssueKey;

    if (nextIssue && selectedRunTargetPath) {
      setSelectedFilePath(toRelativeRunPath(selectedRunTargetPath, nextIssue.file));
    }
  }, [issues, selectedRunTargetPath, selectedIssueKeyRef, setSelectedFilePath, setSelectedIssueIndex]);

  const handleSelectFile = useCallback((filePath: string) => {
    setSelectedFilePath(filePath);

    if (!selectedRunTargetPath) {
      return;
    }

    const nextIssueIndex = findFirstIssueIndexForFile(issues, selectedRunTargetPath, filePath);
    if (nextIssueIndex >= 0) {
      selectIssueByIndex(nextIssueIndex);
    }
  }, [issues, selectIssueByIndex, selectedRunTargetPath, setSelectedFilePath]);

  const handleSelectIssueInFile = useCallback((issueIndex: number) => {
    if (issueIndex < 0 || !selectedRunTargetPath) {
      return;
    }

    const selectedIssue = issues[issueIndex];
    if (!selectedIssue) {
      return;
    }

    setSelectedFilePath(toRelativeRunPath(selectedRunTargetPath, selectedIssue.file));
    selectIssueByIndex(issueIndex);
  }, [issues, selectIssueByIndex, selectedRunTargetPath, setSelectedFilePath]);

  return {
    selectIssueByIndex,
    handleSelectFile,
    handleSelectIssueInFile
  };
}

export function useAutoSelectIssueInFile({
  selectedFilePath,
  fileIssuesForViewer,
  hasActiveIssueForViewer,
  onSelectIssueByIndex
}: {
  selectedFilePath: string | null;
  fileIssuesForViewer: FileIssueViewItem[];
  hasActiveIssueForViewer: boolean;
  onSelectIssueByIndex: (nextIndex: number) => void;
}): void {
  useEffect(() => {
    if (!selectedFilePath || fileIssuesForViewer.length === 0 || hasActiveIssueForViewer) {
      return;
    }

    const firstIssueIndex = fileIssuesForViewer[0]?.issueIndex;
    if (typeof firstIssueIndex === "number") {
      onSelectIssueByIndex(firstIssueIndex);
    }
  }, [selectedFilePath, fileIssuesForViewer, hasActiveIssueForViewer, onSelectIssueByIndex]);
}
