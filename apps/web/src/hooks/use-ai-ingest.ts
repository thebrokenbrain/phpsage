// This hook manages AI ingest trigger and job status polling for the dashboard.

import { useCallback, useEffect, useState } from "react";
import type { AiIngestJobPayload } from "../types.js";

export type IngestStatusFilter = "all" | "queued" | "running" | "completed" | "failed";

interface UseAiIngestOptions {
  apiBase: string;
  pollIntervalMs: number;
}

interface UseAiIngestResult {
  activeIngestJob: AiIngestJobPayload | null;
  recentIngestJobs: AiIngestJobPayload[];
  ingestStatusFilter: IngestStatusFilter;
  ingestListLoading: boolean;
  ingestLoading: boolean;
  ingestError: string | null;
  setIngestStatusFilter: (status: IngestStatusFilter) => void;
  startIngestFromUi: (targetPath?: string) => Promise<void>;
  refreshRecentIngestJobs: (limit?: number, status?: IngestStatusFilter) => Promise<void>;
}

export function useAiIngest({ apiBase, pollIntervalMs }: UseAiIngestOptions): UseAiIngestResult {
  const [activeIngestJob, setActiveIngestJob] = useState<AiIngestJobPayload | null>(null);
  const [recentIngestJobs, setRecentIngestJobs] = useState<AiIngestJobPayload[]>([]);
  const [ingestStatusFilter, setIngestStatusFilter] = useState<IngestStatusFilter>("all");
  const [ingestListLoading, setIngestListLoading] = useState(false);
  const [ingestLoading, setIngestLoading] = useState(false);
  const [ingestError, setIngestError] = useState<string | null>(null);

  const refreshRecentIngestJobs = useCallback(async (limit = 8, status: IngestStatusFilter = ingestStatusFilter): Promise<void> => {
    setIngestListLoading(true);

    try {
      const query = status === "all"
        ? `limit=${limit}`
        : `limit=${limit}&status=${status}`;
      const response = await fetch(`${apiBase}/api/ai/ingest?${query}`, {
        method: "GET"
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const jobs = (await response.json()) as AiIngestJobPayload[];
      setRecentIngestJobs(jobs);
    } catch (error) {
      setIngestError(error instanceof Error ? error.message : String(error));
    } finally {
      setIngestListLoading(false);
    }
  }, [apiBase, ingestStatusFilter]);

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
      void refreshRecentIngestJobs(8, ingestStatusFilter);
    } catch (error) {
      setIngestError(error instanceof Error ? error.message : String(error));
    } finally {
      setIngestLoading(false);
    }
  }, [apiBase, ingestStatusFilter, refreshRecentIngestJobs]);

  useEffect(() => {
    let isCancelled = false;

    void (async () => {
      try {
        const response = await fetch(`${apiBase}/api/ai/ingest/latest`, {
          method: "GET"
        });

        if (response.status === 404 || isCancelled) {
          return;
        }

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const latest = (await response.json()) as AiIngestJobPayload;
        if (!isCancelled) {
          setActiveIngestJob(latest);
          void refreshRecentIngestJobs(8, ingestStatusFilter);
        }
      } catch (error) {
        if (!isCancelled) {
          setIngestError(error instanceof Error ? error.message : String(error));
        }
      }
    })();

    return () => {
      isCancelled = true;
    };
  }, [apiBase, ingestStatusFilter, refreshRecentIngestJobs]);

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
            void refreshRecentIngestJobs(8, ingestStatusFilter);
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
  }, [activeIngestJob, fetchJobById, ingestStatusFilter, pollIntervalMs, refreshRecentIngestJobs]);

  useEffect(() => {
    void refreshRecentIngestJobs(8, ingestStatusFilter);
  }, [ingestStatusFilter, refreshRecentIngestJobs]);

  return {
    activeIngestJob,
    recentIngestJobs,
    ingestStatusFilter,
    ingestListLoading,
    ingestLoading,
    ingestError,
    setIngestStatusFilter,
    startIngestFromUi,
    refreshRecentIngestJobs
  };
}
