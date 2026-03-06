import { useMemo } from "react";
import type { RunSummary } from "../types.js";

interface UseRunsFiltersViewModelOptions {
  runs: RunSummary[];
  runsStatusFilter: "all" | "running" | "finished";
  runsSortOrder: "updatedDesc" | "updatedAsc";
  fileSearchTerm: string;
  issueSearchTerm: string;
  issueIdentifierFilter: "all" | "with" | "without";
  logSearchTerm: string;
  logStreamFilter: "all" | "stdout" | "stderr";
  isLivePollingEnabled: boolean;
  livePollingIntervalMs: number;
  defaultRunningPollIntervalMs: number;
  isAutoRunEnabled: boolean;
  autoRunIntervalMs: number;
  autoRunTargetMode: "starter" | "selected";
  autoRunPauseWhenHidden: boolean;
  autoRunMaxFailures: number;
  autoRunConsecutiveFailures: number;
}

interface UseRunsFiltersViewModelResult {
  visibleRuns: RunSummary[];
  runsSummary: {
    total: number;
    running: number;
    finished: number;
  };
  activeControlLabels: string[];
  latestRunningRunId: string | null;
}

export function useRunsFiltersViewModel({
  runs,
  runsStatusFilter,
  runsSortOrder,
  fileSearchTerm,
  issueSearchTerm,
  issueIdentifierFilter,
  logSearchTerm,
  logStreamFilter,
  isLivePollingEnabled,
  livePollingIntervalMs,
  defaultRunningPollIntervalMs,
  isAutoRunEnabled,
  autoRunIntervalMs,
  autoRunTargetMode,
  autoRunPauseWhenHidden,
  autoRunMaxFailures,
  autoRunConsecutiveFailures
}: UseRunsFiltersViewModelOptions): UseRunsFiltersViewModelResult {
  const filteredRuns = useMemo(() => {
    if (runsStatusFilter === "all") {
      return runs;
    }

    return runs.filter((run) => run.status === runsStatusFilter);
  }, [runs, runsStatusFilter]);

  const visibleRuns = useMemo(() => {
    const sortedRuns = [...filteredRuns];
    sortedRuns.sort((leftRun, rightRun) => {
      const leftTimestamp = new Date(leftRun.updatedAt).getTime();
      const rightTimestamp = new Date(rightRun.updatedAt).getTime();

      if (runsSortOrder === "updatedAsc") {
        return leftTimestamp - rightTimestamp;
      }

      return rightTimestamp - leftTimestamp;
    });

    return sortedRuns;
  }, [filteredRuns, runsSortOrder]);

  const runsSummary = useMemo(() => {
    const runningCount = runs.filter((run) => run.status === "running").length;
    return {
      total: runs.length,
      running: runningCount,
      finished: runs.length - runningCount
    };
  }, [runs]);

  const activeControlLabels = useMemo(() => {
    const labels: string[] = [];

    if (runsStatusFilter !== "all") {
      labels.push(`status:${runsStatusFilter}`);
    }

    if (runsSortOrder !== "updatedDesc") {
      labels.push(`sort:${runsSortOrder}`);
    }

    if (fileSearchTerm.trim().length > 0) {
      labels.push("fileQuery");
    }

    if (issueSearchTerm.trim().length > 0) {
      labels.push("issueQuery");
    }

    if (issueIdentifierFilter !== "all") {
      labels.push(`issueIdentifier:${issueIdentifierFilter}`);
    }

    if (logSearchTerm.trim().length > 0) {
      labels.push("logQuery");
    }

    if (logStreamFilter !== "all") {
      labels.push(`logStream:${logStreamFilter}`);
    }

    if (!isLivePollingEnabled) {
      labels.push("live:off");
    }

    if (livePollingIntervalMs !== defaultRunningPollIntervalMs) {
      labels.push(`interval:${livePollingIntervalMs}`);
    }

    if (isAutoRunEnabled) {
      labels.push("auto:on");
      if (autoRunIntervalMs !== 15000) {
        labels.push(`autoInterval:${autoRunIntervalMs}`);
      }
      if (autoRunTargetMode !== "starter") {
        labels.push(`autoTarget:${autoRunTargetMode}`);
      }
      if (!autoRunPauseWhenHidden) {
        labels.push("autoPauseHidden:off");
      }
      if (autoRunMaxFailures !== 3) {
        labels.push(`autoMaxFailures:${autoRunMaxFailures}`);
      }
      if (autoRunConsecutiveFailures > 0) {
        labels.push(`autoBackoff:x${1 + Math.min(autoRunConsecutiveFailures, 4)}`);
      }
    }

    return labels;
  }, [
    autoRunIntervalMs,
    autoRunConsecutiveFailures,
    autoRunMaxFailures,
    autoRunPauseWhenHidden,
    fileSearchTerm,
    isAutoRunEnabled,
    isLivePollingEnabled,
    issueIdentifierFilter,
    issueSearchTerm,
    livePollingIntervalMs,
    logSearchTerm,
    logStreamFilter,
    autoRunTargetMode,
    runsSortOrder,
    runsStatusFilter,
    defaultRunningPollIntervalMs
  ]);

  const latestRunningRunId = useMemo(() => {
    const runningRuns = runs.filter((run) => run.status === "running");
    if (runningRuns.length === 0) {
      return null;
    }

    const sortedRunningRuns = [...runningRuns].sort(
      (leftRun, rightRun) => new Date(rightRun.updatedAt).getTime() - new Date(leftRun.updatedAt).getTime()
    );

    return sortedRunningRuns[0]?.runId ?? null;
  }, [runs]);

  return {
    visibleRuns,
    runsSummary,
    activeControlLabels,
    latestRunningRunId
  };
}