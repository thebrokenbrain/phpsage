// This hook loads source payload for the currently resolved run file.
import { useEffect, useState } from "react";
import type { SourcePayload } from "../types.js";
import { formatError } from "../utils/app-helpers.js";

interface UseRunSourceOptions {
  apiBase: string;
  runId: string | null;
  filePath: string | null;
}

interface UseRunSourceResult {
  sourcePayload: SourcePayload | null;
  sourceLoading: boolean;
  sourceError: string | null;
}

export function buildRunSourceEndpoint(apiBase: string, runId: string, filePath: string): string {
  return `${apiBase}/api/runs/${runId}/source?file=${encodeURIComponent(filePath)}`;
}

export function useRunSource({ apiBase, runId, filePath }: UseRunSourceOptions): UseRunSourceResult {
  const [sourcePayload, setSourcePayload] = useState<SourcePayload | null>(null);
  const [sourceLoading, setSourceLoading] = useState(false);
  const [sourceError, setSourceError] = useState<string | null>(null);

  useEffect(() => {
    if (!runId || !filePath) {
      setSourceLoading(false);
      setSourceError(null);
      setSourcePayload(null);
      return;
    }

    const abortController = new AbortController();
    setSourceLoading(true);
    setSourceError(null);

    void (async () => {
      try {
        const endpoint = buildRunSourceEndpoint(apiBase, runId, filePath);
        const response = await fetch(endpoint, { signal: abortController.signal });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const payload = (await response.json()) as SourcePayload;
        if (abortController.signal.aborted) {
          return;
        }

        setSourcePayload(payload);
      } catch (fetchError) {
        if (abortController.signal.aborted) {
          return;
        }

        setSourceError(formatError(fetchError));
        setSourcePayload(null);
      } finally {
        if (!abortController.signal.aborted) {
          setSourceLoading(false);
        }
      }
    })();

    return () => {
      abortController.abort();
    };
  }, [apiBase, filePath, runId]);

  return {
    sourcePayload,
    sourceLoading,
    sourceError
  };
}
