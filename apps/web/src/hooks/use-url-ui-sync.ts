// This hook synchronizes UI state with URL query params and browser navigation.
import { useEffect } from "react";
import type { ViewMode } from "../types.js";
import { parseUiStateFromUrl, syncUiStateToUrl } from "../utils/url-ui-state.js";

interface UseUrlUiSyncOptions {
  selectedRunId: string | null;
  safeIssueIndex: number;
  viewMode: ViewMode;
  hasIssues: boolean;
  onSetSelectedRunId: (runId: string | null) => void;
  onSetSelectedIssueIndex: (issueIndex: number) => void;
  onSetViewMode: (viewMode: ViewMode) => void;
}

function applyUrlUiState(options: {
  onSetSelectedRunId: (runId: string | null) => void;
  onSetSelectedIssueIndex: (issueIndex: number) => void;
  onSetViewMode: (viewMode: ViewMode) => void;
}): void {
  const nextState = parseUiStateFromUrl();
  options.onSetSelectedRunId(nextState.runId);
  options.onSetSelectedIssueIndex(nextState.issueIndex);
  options.onSetViewMode(nextState.viewMode);
}

export function buildUrlSyncPayload(options: {
  selectedRunId: string | null;
  safeIssueIndex: number;
  viewMode: ViewMode;
  hasIssues: boolean;
}): {
  runId: string | null;
  issueIndex: number;
  viewMode: ViewMode;
  hasIssues: boolean;
} {
  return {
    runId: options.selectedRunId,
    issueIndex: options.safeIssueIndex,
    viewMode: options.viewMode,
    hasIssues: options.hasIssues
  };
}

export function useUrlUiSync({
  selectedRunId,
  safeIssueIndex,
  viewMode,
  hasIssues,
  onSetSelectedRunId,
  onSetSelectedIssueIndex,
  onSetViewMode
}: UseUrlUiSyncOptions): void {
  useEffect(() => {
    const handlePopState = () => {
      applyUrlUiState({
        onSetSelectedRunId,
        onSetSelectedIssueIndex,
        onSetViewMode
      });
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [onSetSelectedRunId, onSetSelectedIssueIndex, onSetViewMode]);

  useEffect(() => {
    syncUiStateToUrl(buildUrlSyncPayload({ selectedRunId, safeIssueIndex, viewMode, hasIssues }));
  }, [selectedRunId, safeIssueIndex, viewMode, hasIssues]);
}
