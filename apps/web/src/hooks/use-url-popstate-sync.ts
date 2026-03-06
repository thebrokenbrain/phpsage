// This hook centralizes browser popstate synchronization from URL query into dashboard state.
import { useEffect } from "react";

interface UrlSelectionSnapshot {
  runId: string | null;
  file: string | null;
  issueIndex: number | null;
  logPage: number | null;
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
  autoRunIntervalMs: number | null;
  autoRunTargetMode: "starter" | "selected";
  autoRunPauseWhenHidden: boolean;
  autoRunMaxFailures: number | null;
  startTargetPath: string | null;
  isLivePollingEnabled: boolean;
  livePollingIntervalMs: number | null;
}

interface UseUrlPopstateSyncOptions {
  readSelectionFromUrl: () => UrlSelectionSnapshot;
  applySelection: (selection: UrlSelectionSnapshot) => void;
}

export function useUrlPopstateSync({ readSelectionFromUrl, applySelection }: UseUrlPopstateSyncOptions): void {
  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    function handlePopState(): void {
      const selection = readSelectionFromUrl();
      applySelection(selection);
    }

    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, [applySelection, readSelectionFromUrl]);
}
