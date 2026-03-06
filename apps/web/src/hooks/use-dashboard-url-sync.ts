import { useEffect } from "react";

interface DashboardUrlSyncState {
  selectedRunId: string | null;
  runsStatusFilter: "all" | "running" | "finished";
  runsSortOrder: "updatedDesc" | "updatedAsc";
  fileSearchTerm: string;
  issueSearchTerm: string;
  issueIdentifierFilter: "all" | "with" | "without";
  logSearchTerm: string;
  logStreamFilter: "all" | "stdout" | "stderr";
  isFilesSectionOpen: boolean;
  isIssuesSectionOpen: boolean;
  isSourceSectionOpen: boolean;
  isLogsSectionOpen: boolean;
  isAutoRunEnabled: boolean;
  autoRunIntervalMs: number;
  autoRunTargetMode: "starter" | "selected";
  autoRunPauseWhenHidden: boolean;
  autoRunMaxFailures: number;
  startRunTargetPath: string;
  isLivePollingEnabled: boolean;
  livePollingIntervalMs: number;
  selectedSourceFilePath: string | null;
  selectedIssueIndex: number;
  logPage: number;
  hasIssuesForSelectedRun: boolean;
  hasLogsForSelectedRun: boolean;
  defaultRunningPollIntervalMs: number;
}

export function buildDashboardUrlSearch(state: DashboardUrlSyncState): string {
  const searchParams = new URLSearchParams();

  if (state.selectedRunId) {
    searchParams.set("runId", state.selectedRunId);
  }

  if (state.runsStatusFilter !== "all") {
    searchParams.set("status", state.runsStatusFilter);
  }

  if (state.runsSortOrder !== "updatedDesc") {
    searchParams.set("sort", state.runsSortOrder);
  }

  if (state.fileSearchTerm.trim().length > 0) {
    searchParams.set("fileQuery", state.fileSearchTerm);
  }

  if (state.issueSearchTerm.trim().length > 0) {
    searchParams.set("issueQuery", state.issueSearchTerm);
  }

  if (state.issueIdentifierFilter !== "all") {
    searchParams.set("issueIdentifier", state.issueIdentifierFilter);
  }

  if (state.logSearchTerm.trim().length > 0) {
    searchParams.set("logQuery", state.logSearchTerm);
  }

  if (state.logStreamFilter !== "all") {
    searchParams.set("logStream", state.logStreamFilter);
  }

  if (!state.isFilesSectionOpen) {
    searchParams.set("filesOpen", "0");
  }

  if (!state.isIssuesSectionOpen) {
    searchParams.set("issuesOpen", "0");
  }

  if (!state.isSourceSectionOpen) {
    searchParams.set("sourceOpen", "0");
  }

  if (!state.isLogsSectionOpen) {
    searchParams.set("logsOpen", "0");
  }

  if (state.isAutoRunEnabled) {
    searchParams.set("auto", "1");
  }

  if (state.autoRunIntervalMs !== 15000) {
    searchParams.set("autoInterval", String(state.autoRunIntervalMs));
  }

  if (state.autoRunTargetMode !== "starter") {
    searchParams.set("autoTarget", state.autoRunTargetMode);
  }

  if (!state.autoRunPauseWhenHidden) {
    searchParams.set("autoPauseHidden", "0");
  }

  if (state.autoRunMaxFailures !== 3) {
    searchParams.set("autoMaxFailures", String(state.autoRunMaxFailures));
  }

  if (state.startRunTargetPath.trim().length > 0) {
    searchParams.set("target", state.startRunTargetPath);
  }

  if (!state.isLivePollingEnabled) {
    searchParams.set("live", "0");
  }

  if (state.livePollingIntervalMs !== state.defaultRunningPollIntervalMs) {
    searchParams.set("interval", String(state.livePollingIntervalMs));
  }

  if (state.selectedSourceFilePath) {
    searchParams.set("file", state.selectedSourceFilePath);
  }

  if (state.hasIssuesForSelectedRun) {
    searchParams.set("issue", String(state.selectedIssueIndex));
  }

  if (state.hasLogsForSelectedRun && state.logPage > 0) {
    searchParams.set("logPage", String(state.logPage));
  }

  const queryString = searchParams.toString();
  return queryString.length > 0 ? `?${queryString}` : "";
}

export function useDashboardUrlSync(state: DashboardUrlSyncState): void {
  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const query = buildDashboardUrlSearch(state);
    const url = `${window.location.pathname}${query}${window.location.hash}`;
    window.history.replaceState({}, "", url);
  }, [state]);
}
