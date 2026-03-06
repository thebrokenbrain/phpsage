// This hook encapsulates runs polling, run detail/files loading, AI health probing, and run start orchestration.
import { useEffect, useRef, useState, type MutableRefObject } from "react";
import type { AiHealthResponse, RunFileEntry, RunFilesResponse, RunRecord, RunSummary } from "../types.js";
import { formatError, getIssueKey } from "../utils/app-helpers.js";

interface UseRunsRuntimeOptions {
  apiBase: string;
  initialRunId: string | null;
  runTargetDefaultPath: string;
  aiHealthFailureThreshold: number;
  selectedIssueKeyRef: MutableRefObject<string | null>;
  setSelectedIssueIndex: (value: number | ((current: number) => number)) => void;
  onRunSelectionCleared?: () => void;
}

interface UseRunsRuntimeResult {
  runs: RunSummary[];
  selectedRunId: string | null;
  setSelectedRunId: (runId: string | null) => void;
  selectedRun: RunRecord | null;
  runFiles: RunFileEntry[];
  isRunDetailLoading: boolean;
  loading: boolean;
  error: string | null;
  isLlmAvailable: boolean | null;
  activeAiProvider: string | null;
  activeAiModel: string | null;
  handleStartRun: () => Promise<void>;
}

export function useRunsRuntime({
  apiBase,
  initialRunId,
  runTargetDefaultPath,
  aiHealthFailureThreshold,
  selectedIssueKeyRef,
  setSelectedIssueIndex,
  onRunSelectionCleared
}: UseRunsRuntimeOptions): UseRunsRuntimeResult {
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(initialRunId);
  const [selectedRun, setSelectedRun] = useState<RunRecord | null>(null);
  const [runFiles, setRunFiles] = useState<RunFileEntry[]>([]);
  const [isRunDetailLoading, setIsRunDetailLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLlmAvailable, setIsLlmAvailable] = useState<boolean | null>(null);
  const [activeAiProvider, setActiveAiProvider] = useState<string | null>(null);
  const [activeAiModel, setActiveAiModel] = useState<string | null>(null);

  const runDetailRequestRef = useRef(0);
  const aiHealthFailureCountRef = useRef(0);

  useEffect(() => {
    void refreshRuns();
    void refreshAiHealth();

    const interval = setInterval(() => {
      void refreshRuns();
      void refreshAiHealth();
      if (selectedRunId) {
        void refreshRunDetail(selectedRunId);
        void refreshRunFiles(selectedRunId);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [selectedRunId]);

  useEffect(() => {
    if (runs.length === 0) {
      setSelectedRunId(null);
      setSelectedRun(null);
      setRunFiles([]);
      setIsRunDetailLoading(false);
      onRunSelectionCleared?.();
      return;
    }

    if (!selectedRunId || !runs.some((run: RunSummary) => run.runId === selectedRunId)) {
      setSelectedRunId(runs[0].runId);
    }
  }, [runs, selectedRunId, onRunSelectionCleared]);

  useEffect(() => {
    if (!selectedRunId) {
      setIsRunDetailLoading(false);
      setRunFiles([]);
      onRunSelectionCleared?.();
      return;
    }

    void refreshRunDetail(selectedRunId);
    void refreshRunFiles(selectedRunId);
  }, [selectedRunId, onRunSelectionCleared]);

  async function refreshRuns(): Promise<void> {
    try {
      const response = await fetch(`${apiBase}/api/runs`);
      if (!response.ok) {
        throw new Error(`Cannot load runs (${response.status})`);
      }

      const data = (await response.json()) as RunSummary[];
      setRuns(data);
      setError(null);
    } catch (unknownError) {
      setError(formatError(unknownError));
    }
  }

  async function refreshAiHealth(): Promise<void> {
    try {
      const response = await fetch(`${apiBase}/api/ai/health`);
      if (!response.ok) {
        aiHealthFailureCountRef.current += 1;
        if (aiHealthFailureCountRef.current >= aiHealthFailureThreshold) {
          setIsLlmAvailable(false);
        }
        return;
      }

      const data = (await response.json()) as AiHealthResponse;
      const llmProviderStatus = data.providers.find((provider) => provider.provider === "ollama" || provider.provider === "openai")?.status;

      if (llmProviderStatus === "up") {
        aiHealthFailureCountRef.current = 0;
        setIsLlmAvailable(true);
      } else {
        aiHealthFailureCountRef.current += 1;
        if (aiHealthFailureCountRef.current >= aiHealthFailureThreshold) {
          setIsLlmAvailable(false);
        }
      }

      setActiveAiProvider(data.activeProvider ?? null);
      setActiveAiModel(data.activeModel ?? null);
    } catch {
      aiHealthFailureCountRef.current += 1;
      if (aiHealthFailureCountRef.current >= aiHealthFailureThreshold) {
        setIsLlmAvailable(false);
        setActiveAiProvider(null);
        setActiveAiModel(null);
      }
    }
  }

  async function refreshRunDetail(runId: string): Promise<void> {
    const requestId = runDetailRequestRef.current + 1;
    runDetailRequestRef.current = requestId;
    setIsRunDetailLoading(true);

    try {
      const response = await fetch(`${apiBase}/api/runs/${runId}`);
      if (!response.ok) {
        throw new Error(`Cannot load run ${runId}`);
      }

      const data = (await response.json()) as RunRecord;
      if (requestId !== runDetailRequestRef.current) {
        return;
      }

      setSelectedRun(data);
      setSelectedIssueIndex((current) => {
        if (data.issues.length === 0) {
          return 0;
        }

        const selectedIssueKey = selectedIssueKeyRef.current;
        if (selectedIssueKey) {
          const preservedIndex = data.issues.findIndex((issue) => getIssueKey(issue) === selectedIssueKey);
          if (preservedIndex >= 0) {
            return preservedIndex;
          }
        }

        return Math.min(current, Math.max(data.issues.length - 1, 0));
      });
      setError(null);
    } catch (unknownError) {
      if (requestId !== runDetailRequestRef.current) {
        return;
      }

      setError(formatError(unknownError));
    } finally {
      if (requestId === runDetailRequestRef.current) {
        setIsRunDetailLoading(false);
      }
    }
  }

  async function refreshRunFiles(runId: string): Promise<void> {
    try {
      const response = await fetch(`${apiBase}/api/runs/${runId}/files`);
      if (!response.ok) {
        throw new Error(`Cannot load run files (${response.status})`);
      }

      const data = (await response.json()) as RunFilesResponse;
      setRunFiles(data.files);
      setError(null);
    } catch (unknownError) {
      setError(formatError(unknownError));
    }
  }

  async function handleStartRun(): Promise<void> {
    const targetPath = (selectedRun?.targetPath ?? runTargetDefaultPath).trim();

    setLoading(true);
    try {
      const response = await fetch(`${apiBase}/api/runs/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetPath, execute: true })
      });
      if (!response.ok) {
        throw new Error(`Run start failed (${response.status})`);
      }

      const run = (await response.json()) as RunRecord;
      setSelectedRunId(run.runId);
      await refreshRuns();
      setError(null);
    } catch (unknownError) {
      setError(formatError(unknownError));
    } finally {
      setLoading(false);
    }
  }

  return {
    runs,
    selectedRunId,
    setSelectedRunId,
    selectedRun,
    runFiles,
    isRunDetailLoading,
    loading,
    error,
    isLlmAvailable,
    activeAiProvider,
    activeAiModel,
    handleStartRun
  };
}
