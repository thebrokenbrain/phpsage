// This hook centralizes derived run/issue view state used by the App composition root.
import { useMemo } from "react";
import type { FileIssueViewItem } from "../components/code-window.js";
import type { RunIssue, RunRecord, ViewMode } from "../types.js";
import { toAbsoluteRunPath, toRelativeRunPath } from "../utils/run-file-tree.js";

interface UseRunViewModelOptions {
  selectedRun: RunRecord | null;
  selectedIssueIndex: number;
  selectedFilePath: string | null;
  viewMode: ViewMode;
}

interface UseRunViewModelResult {
  issues: RunIssue[];
  safeIssueIndex: number;
  activeIssue: RunIssue | null;
  hasIssues: boolean;
  resolvedRunId: string | null;
  activeIssueRelativePath: string | null;
  activeIssueForViewer: RunIssue | null;
  activeIssueIndexForViewer: number | null;
  aiContextIssue: RunIssue | null;
  fileIssuesForViewer: FileIssueViewItem[];
  absoluteSourceFilePath: string | null;
  identifiers: Array<[string, number]>;
}

export function getSafeIssueIndex(issuesLength: number, selectedIssueIndex: number): number {
  return Math.min(selectedIssueIndex, Math.max(issuesLength - 1, 0));
}

export function buildIssueIdentifierCounts(issues: RunIssue[]): Array<[string, number]> {
  const counts = new Map<string, number>();
  for (const issue of issues) {
    const key = issue.identifier ?? "unknown";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return Array.from(counts.entries()).sort((left, right) => right[1] - left[1]);
}

export function buildFileIssuesForViewer(
  issues: RunIssue[],
  runTargetPath: string | undefined,
  selectedFilePath: string | null
): FileIssueViewItem[] {
  if (!runTargetPath || !selectedFilePath) {
    return [];
  }

  return issues
    .map((issue, issueIndex) => ({ issue, issueIndex }))
    .filter(({ issue }) => toRelativeRunPath(runTargetPath, issue.file) === selectedFilePath)
    .sort((left, right) => {
      if (left.issue.line === right.issue.line) {
        return left.issueIndex - right.issueIndex;
      }

      return left.issue.line - right.issue.line;
    });
}

export function useRunViewModel({
  selectedRun,
  selectedIssueIndex,
  selectedFilePath,
  viewMode
}: UseRunViewModelOptions): UseRunViewModelResult {
  const issues = selectedRun?.issues ?? [];
  const safeIssueIndex = getSafeIssueIndex(issues.length, selectedIssueIndex);
  const activeIssue = issues[safeIssueIndex] ?? null;
  const hasIssues = issues.length > 0;
  const resolvedRunId = selectedRun?.runId ?? null;

  const activeIssueRelativePath = useMemo(() => {
    if (!activeIssue || !selectedRun) {
      return null;
    }

    return toRelativeRunPath(selectedRun.targetPath, activeIssue.file);
  }, [activeIssue, selectedRun?.targetPath]);

  const isActiveIssueInSelectedFile =
    !!activeIssue && !!selectedFilePath && !!activeIssueRelativePath && activeIssueRelativePath === selectedFilePath;

  const activeIssueForViewer = isActiveIssueInSelectedFile ? activeIssue : null;
  const activeIssueIndexForViewer = isActiveIssueInSelectedFile ? safeIssueIndex : null;
  const aiContextIssue = viewMode === "dashboard" ? activeIssueForViewer : activeIssue;

  const fileIssuesForViewer = useMemo(() => {
    return buildFileIssuesForViewer(issues, selectedRun?.targetPath, selectedFilePath);
  }, [issues, selectedRun?.targetPath, selectedFilePath]);

  const absoluteSourceFilePath = useMemo(() => {
    if (!selectedRun || !selectedFilePath) {
      return null;
    }

    return toAbsoluteRunPath(selectedRun.targetPath, selectedFilePath);
  }, [selectedRun?.targetPath, selectedFilePath]);

  const identifiers = useMemo(() => buildIssueIdentifierCounts(issues), [issues]);

  return {
    issues,
    safeIssueIndex,
    activeIssue,
    hasIssues,
    resolvedRunId,
    activeIssueRelativePath,
    activeIssueForViewer,
    activeIssueIndexForViewer,
    aiContextIssue,
    fileIssuesForViewer,
    absoluteSourceFilePath,
    identifiers
  };
}