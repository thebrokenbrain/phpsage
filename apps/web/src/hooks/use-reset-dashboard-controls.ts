import { useCallback } from "react";

interface UseResetDashboardControlsOptions {
  setRunsStatusFilter: (value: "all" | "running" | "finished") => void;
  setRunsSortOrder: (value: "updatedDesc" | "updatedAsc") => void;
  setIssueSearchTerm: (value: string) => void;
  setIssueIdentifierFilter: (value: "all" | "with" | "without") => void;
  setLogSearchTerm: (value: string) => void;
  setLogStreamFilter: (value: "all" | "stdout" | "stderr") => void;
  setFileSearchTerm: (value: string) => void;
  setIsLivePollingEnabled: (value: boolean) => void;
  setLivePollingIntervalMs: (value: number) => void;
  defaultRunningPollIntervalMs: number;
  setIsFilesSectionOpen: (value: boolean) => void;
  setIsIssuesSectionOpen: (value: boolean) => void;
  setIsSourceSectionOpen: (value: boolean) => void;
  setIsLogsSectionOpen: (value: boolean) => void;
  setAutoRunPauseWhenHidden: (value: boolean) => void;
  setAutoRunMaxFailures: (value: number) => void;
}

interface UseResetDashboardControlsResult {
  resetDashboardControls: () => void;
}

export function useResetDashboardControls({
  setRunsStatusFilter,
  setRunsSortOrder,
  setIssueSearchTerm,
  setIssueIdentifierFilter,
  setLogSearchTerm,
  setLogStreamFilter,
  setFileSearchTerm,
  setIsLivePollingEnabled,
  setLivePollingIntervalMs,
  defaultRunningPollIntervalMs,
  setIsFilesSectionOpen,
  setIsIssuesSectionOpen,
  setIsSourceSectionOpen,
  setIsLogsSectionOpen,
  setAutoRunPauseWhenHidden,
  setAutoRunMaxFailures
}: UseResetDashboardControlsOptions): UseResetDashboardControlsResult {
  const resetDashboardControls = useCallback(() => {
    setRunsStatusFilter("all");
    setRunsSortOrder("updatedDesc");
    setIssueSearchTerm("");
    setIssueIdentifierFilter("all");
    setLogSearchTerm("");
    setLogStreamFilter("all");
    setFileSearchTerm("");
    setIsLivePollingEnabled(true);
    setLivePollingIntervalMs(defaultRunningPollIntervalMs);
    setIsFilesSectionOpen(true);
    setIsIssuesSectionOpen(true);
    setIsSourceSectionOpen(true);
    setIsLogsSectionOpen(true);
    setAutoRunPauseWhenHidden(true);
    setAutoRunMaxFailures(3);
  }, [
    defaultRunningPollIntervalMs,
    setAutoRunMaxFailures,
    setAutoRunPauseWhenHidden,
    setFileSearchTerm,
    setIsFilesSectionOpen,
    setIsIssuesSectionOpen,
    setIsLivePollingEnabled,
    setIsLogsSectionOpen,
    setIsSourceSectionOpen,
    setIssueIdentifierFilter,
    setIssueSearchTerm,
    setLivePollingIntervalMs,
    setLogSearchTerm,
    setLogStreamFilter,
    setRunsSortOrder,
    setRunsStatusFilter
  ]);

  return {
    resetDashboardControls
  };
}