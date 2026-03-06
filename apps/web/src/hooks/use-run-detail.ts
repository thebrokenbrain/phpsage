import { useEffect, useState } from "react";
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
}

export function buildRunDetailEndpoint(apiBase: string, runId: string): string {
  return `${apiBase}/api/runs/${runId}`;
}

export function useRunDetail({ apiBase, runId }: UseRunDetailOptions): UseRunDetailResult {
  const [selectedRun, setSelectedRun] = useState<RunRecord | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  useEffect(() => {
    if (!runId) {
      setSelectedRun(null);
      setDetailLoading(false);
      setDetailError(null);
      return;
    }

    const abortController = new AbortController();
    setDetailLoading(true);
    setDetailError(null);

    void (async () => {
      try {
        const response = await fetch(buildRunDetailEndpoint(apiBase, runId), {
          signal: abortController.signal
        });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const payload = (await response.json()) as RunRecord;
        if (abortController.signal.aborted) {
          return;
        }

        setSelectedRun(payload);
      } catch (fetchError) {
        if (abortController.signal.aborted) {
          return;
        }

        setDetailError(formatError(fetchError));
        setSelectedRun(null);
      } finally {
        if (!abortController.signal.aborted) {
          setDetailLoading(false);
        }
      }
    })();

    return () => {
      abortController.abort();
    };
  }, [apiBase, runId]);

  return {
    selectedRun,
    detailLoading,
    detailError
  };
}
