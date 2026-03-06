import { useEffect } from "react";
import type { RunSummary } from "../types.js";
import { formatError } from "../utils/app-helpers.js";

interface UseRunningRunPollingOptions {
  apiBaseUrl: string;
  isLivePollingEnabled: boolean;
  livePollingIntervalMs: number;
  selectedRunId: string | null;
  selectedRunStatus: "running" | "finished" | null;
  refreshRunDetail: () => Promise<void>;
  refreshRunFiles: () => Promise<void>;
  setRuns: (value: RunSummary[] | ((current: RunSummary[]) => RunSummary[])) => void;
  setLastRefreshAt: (value: string | null | ((current: string | null) => string | null)) => void;
  setError: (value: string | null | ((current: string | null) => string | null)) => void;
}

export function useRunningRunPolling({
  apiBaseUrl,
  isLivePollingEnabled,
  livePollingIntervalMs,
  selectedRunId,
  selectedRunStatus,
  refreshRunDetail,
  refreshRunFiles,
  setRuns,
  setLastRefreshAt,
  setError
}: UseRunningRunPollingOptions): void {
  useEffect(() => {
    async function pollRunningRun(): Promise<void> {
      try {
        const runsResponse = await fetch(`${apiBaseUrl}/api/runs`);

        if (!runsResponse.ok) {
          throw new Error(`HTTP ${runsResponse.status}`);
        }

        const runsPayload = (await runsResponse.json()) as RunSummary[];

        await Promise.all([refreshRunDetail(), refreshRunFiles()]);

        setRuns(runsPayload);
        setLastRefreshAt(new Date().toISOString());
      } catch (pollError) {
        const message = formatError(pollError);
        setError(message);
      }
    }

    if (!isLivePollingEnabled || !selectedRunId || selectedRunStatus !== "running") {
      return;
    }

    const intervalId = window.setInterval(() => {
      void pollRunningRun();
    }, livePollingIntervalMs);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [
    apiBaseUrl,
    isLivePollingEnabled,
    livePollingIntervalMs,
    refreshRunDetail,
    refreshRunFiles,
    selectedRunId,
    selectedRunStatus,
    setError,
    setLastRefreshAt,
    setRuns
  ]);
}