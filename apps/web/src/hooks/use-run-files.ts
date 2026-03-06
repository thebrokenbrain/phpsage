import { useCallback, useEffect, useState } from "react";
import type { RunFileItem, RunFilesPayload } from "../types.js";
import { formatError } from "../utils/app-helpers.js";

interface UseRunFilesOptions {
  apiBase: string;
  runId: string | null;
}

interface UseRunFilesResult {
  runFiles: RunFileItem[];
  filesLoading: boolean;
  filesError: string | null;
  refreshRunFiles: () => Promise<RunFileItem[]>;
}

export function buildRunFilesEndpoint(apiBase: string, runId: string): string {
  return `${apiBase}/api/runs/${runId}/files`;
}

export function useRunFiles({ apiBase, runId }: UseRunFilesOptions): UseRunFilesResult {
  const [runFiles, setRunFiles] = useState<RunFileItem[]>([]);
  const [filesLoading, setFilesLoading] = useState(false);
  const [filesError, setFilesError] = useState<string | null>(null);

  const refreshRunFiles = useCallback(async (): Promise<RunFileItem[]> => {
    if (!runId) {
      setRunFiles([]);
      setFilesError(null);
      setFilesLoading(false);
      return [];
    }

    setFilesLoading(true);
    setFilesError(null);

    try {
      const response = await fetch(buildRunFilesEndpoint(apiBase, runId));
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const payload = (await response.json()) as RunFilesPayload;
      setRunFiles(payload.files);
      return payload.files;
    } catch (fetchError) {
      setFilesError(formatError(fetchError));
      setRunFiles([]);
      return [];
    } finally {
      setFilesLoading(false);
    }
  }, [apiBase, runId]);

  useEffect(() => {
    if (!runId) {
      setRunFiles([]);
      setFilesError(null);
      setFilesLoading(false);
      return;
    }

    void refreshRunFiles();
  }, [refreshRunFiles, runId]);

  return {
    runFiles,
    filesLoading,
    filesError,
    refreshRunFiles
  };
}
