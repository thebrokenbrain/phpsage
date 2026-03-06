import { useCallback, useEffect, useState } from "react";
import type { RunSummary } from "../types.js";
import { formatError } from "../utils/app-helpers.js";

interface UseRunsListOptions {
  apiBaseUrl: string;
  initialSelectedRunId: string | null;
}

interface UseRunsListResult {
  runs: RunSummary[];
  setRuns: (value: RunSummary[] | ((current: RunSummary[]) => RunSummary[])) => void;
  loading: boolean;
  error: string | null;
  setError: (value: string | null | ((current: string | null) => string | null)) => void;
  lastRefreshAt: string | null;
  setLastRefreshAt: (value: string | null | ((current: string | null) => string | null)) => void;
  selectedRunId: string | null;
  setSelectedRunId: (value: string | null | ((current: string | null) => string | null)) => void;
  refreshRuns: () => Promise<void>;
}

export function useRunsList({ apiBaseUrl, initialSelectedRunId }: UseRunsListOptions): UseRunsListResult {
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshAt, setLastRefreshAt] = useState<string | null>(null);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(initialSelectedRunId);

  const refreshRuns = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${apiBaseUrl}/api/runs`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const payload = (await response.json()) as RunSummary[];
      setRuns(payload);
      setLastRefreshAt(new Date().toISOString());

      const fallbackRun =
        payload.find((run) => run.status === "running")
        ?? payload[0];

      if (payload.length === 0) {
        setSelectedRunId(null);
        return;
      }

      setSelectedRunId((currentSelectedRunId) => {
        if (!currentSelectedRunId) {
          return fallbackRun.runId;
        }

        const stillExists = payload.some((run) => run.runId === currentSelectedRunId);
        return stillExists ? currentSelectedRunId : fallbackRun.runId;
      });
    } catch (fetchError) {
      const message = formatError(fetchError);
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [apiBaseUrl]);

  useEffect(() => {
    void refreshRuns();
  }, [refreshRuns]);

  return {
    runs,
    setRuns,
    loading,
    error,
    setError,
    lastRefreshAt,
    setLastRefreshAt,
    selectedRunId,
    setSelectedRunId,
    refreshRuns
  };
}