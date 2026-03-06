import { useCallback, useEffect, useState } from "react";
import type { RunRecord } from "../types.js";
import { formatError } from "../utils/app-helpers.js";

interface UseRunDetailOptions {
  apiBase: string;
  runId: string | null;
}

interface UseRunDetailResult {
  selectedRun: RunRecord | null;
  detailLoading: boolean;
  detailError: string | null;
  refreshRunDetail: () => Promise<RunRecord | null>;
}

export function buildRunDetailEndpoint(apiBase: string, runId: string): string {
  return `${apiBase}/api/runs/${runId}`;
}

export function useRunDetail({ apiBase, runId }: UseRunDetailOptions): UseRunDetailResult {
  const [selectedRun, setSelectedRun] = useState<RunRecord | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const refreshRunDetail = useCallback(async (): Promise<RunRecord | null> => {
    if (!runId) {
      setSelectedRun(null);
      setDetailLoading(false);
      setDetailError(null);
      return null;
    }

    setDetailLoading(true);
    setDetailError(null);

    try {
      const response = await fetch(buildRunDetailEndpoint(apiBase, runId));
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const payload = (await response.json()) as RunRecord;
      setSelectedRun(payload);
      return payload;
    } catch (fetchError) {
      setDetailError(formatError(fetchError));
      setSelectedRun(null);
      return null;
    } finally {
      setDetailLoading(false);
    }
  }, [apiBase, runId]);

  useEffect(() => {
    if (!runId) {
      setSelectedRun(null);
      setDetailLoading(false);
      setDetailError(null);
      return;
    }

    void refreshRunDetail();
  }, [refreshRunDetail, runId]);

  return {
    selectedRun,
    detailLoading,
    detailError,
    refreshRunDetail
  };
}
