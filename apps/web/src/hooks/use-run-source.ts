// This hook loads source content for the currently selected run file.
import { useEffect, useState } from "react";

interface UseRunSourceOptions {
  apiBase: string;
  resolvedRunId: string | null;
  absoluteFilePath: string | null;
}

interface UseRunSourceResult {
  activeSourceContent: string | null;
  activeSourceError: string | null;
}

export function useRunSource({ apiBase, resolvedRunId, absoluteFilePath }: UseRunSourceOptions): UseRunSourceResult {
  const [activeSourceContent, setActiveSourceContent] = useState<string | null>(null);
  const [activeSourceError, setActiveSourceError] = useState<string | null>(null);

  useEffect(() => {
    if (!resolvedRunId || !absoluteFilePath) {
      setActiveSourceContent(null);
      setActiveSourceError(null);
      return;
    }

    void loadActiveSource({
      apiBase,
      runId: resolvedRunId,
      filePath: absoluteFilePath,
      setActiveSourceContent,
      setActiveSourceError
    });
  }, [apiBase, resolvedRunId, absoluteFilePath]);

  return {
    activeSourceContent,
    activeSourceError
  };
}

async function loadActiveSource({
  apiBase,
  runId,
  filePath,
  setActiveSourceContent,
  setActiveSourceError
}: {
  apiBase: string;
  runId: string;
  filePath: string;
  setActiveSourceContent: (value: string | null) => void;
  setActiveSourceError: (value: string | null) => void;
}): Promise<void> {
  try {
    const url = new URL(`${apiBase}/api/runs/${runId}/source`);
    url.searchParams.set("file", filePath);

    const response = await fetch(url.toString());
    if (!response.ok) {
      setActiveSourceContent(null);
      const errorBody = await response.json().catch(() => null) as { error?: string } | null;
      setActiveSourceError(errorBody?.error ?? `Cannot load source (${response.status})`);
      return;
    }

    const data = (await response.json()) as { file: string; content: string };
    setActiveSourceContent(data.content);
    setActiveSourceError(null);
  } catch {
    setActiveSourceContent(null);
    setActiveSourceError("Cannot load source for selected file");
  }
}
