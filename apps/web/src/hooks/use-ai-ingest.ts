// This hook manages AI ingest trigger and job status polling for the dashboard.

import { useCallback, useEffect, useState } from "react";
import type { AiIngestJobPayload } from "../types.js";

interface UseAiIngestOptions {
  apiBase: string;
  pollIntervalMs: number;
}

interface UseAiIngestResult {
  activeIngestJob: AiIngestJobPayload | null;
  ingestLoading: boolean;
  ingestError: string | null;
  startIngestFromUi: (targetPath?: string) => Promise<void>;
}

export function useAiIngest({ apiBase, pollIntervalMs }: UseAiIngestOptions): UseAiIngestResult {
  const [activeIngestJob, setActiveIngestJob] = useState<AiIngestJobPayload | null>(null);
  const [ingestLoading, setIngestLoading] = useState(false);
  const [ingestError, setIngestError] = useState<string | null>(null);

  const fetchJobById = useCallback(async (jobId: string): Promise<AiIngestJobPayload> => {
    const response = await fetch(`${apiBase}/api/ai/ingest/${jobId}`, {
      method: "GET"
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return (await response.json()) as AiIngestJobPayload;
  }, [apiBase]);

  const startIngestFromUi = useCallback(async (targetPath?: string): Promise<void> => {
    setIngestLoading(true);
    setIngestError(null);

    try {
      const payload = targetPath && targetPath.trim().length > 0 ? { targetPath: targetPath.trim() } : {};
      const response = await fetch(`${apiBase}/api/ai/ingest`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const createdJob = (await response.json()) as AiIngestJobPayload;
      setActiveIngestJob(createdJob);
    } catch (error) {
      setIngestError(error instanceof Error ? error.message : String(error));
    } finally {
      setIngestLoading(false);
    }
  }, [apiBase]);

  useEffect(() => {
    if (!activeIngestJob) {
      return;
    }

    if (activeIngestJob.status === "completed" || activeIngestJob.status === "failed") {
      return;
    }

    let isCancelled = false;
    const timeoutId = setTimeout(() => {
      void (async () => {
        try {
          const refreshed = await fetchJobById(activeIngestJob.jobId);
          if (!isCancelled) {
            setActiveIngestJob(refreshed);
          }
        } catch (error) {
          if (!isCancelled) {
            setIngestError(error instanceof Error ? error.message : String(error));
          }
        }
      })();
    }, pollIntervalMs);

    return () => {
      isCancelled = true;
      clearTimeout(timeoutId);
    };
  }, [activeIngestJob, fetchJobById, pollIntervalMs]);

  return {
    activeIngestJob,
    ingestLoading,
    ingestError,
    startIngestFromUi
  };
}
