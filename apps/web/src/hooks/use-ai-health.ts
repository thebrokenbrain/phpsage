import { useEffect, useRef, useState } from "react";
import type { AiHealthPayload } from "../types.js";

interface UseAiHealthOptions {
  apiBase: string;
  failureThreshold: number;
  intervalMs?: number;
}

interface UseAiHealthResult {
  isLlmAvailable: boolean | null;
  activeAiProvider: string | null;
  activeAiModel: string | null;
}

export function useAiHealth({ apiBase, failureThreshold, intervalMs = 15000 }: UseAiHealthOptions): UseAiHealthResult {
  const aiHealthFailureCountRef = useRef(0);
  const [isLlmAvailable, setIsLlmAvailable] = useState<boolean | null>(null);
  const [activeAiProvider, setActiveAiProvider] = useState<string | null>(null);
  const [activeAiModel, setActiveAiModel] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;

    async function loadAiHealth(): Promise<void> {
      try {
        const response = await fetch(`${apiBase}/api/ai/health`);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const payload = (await response.json()) as AiHealthPayload;
        if (isCancelled) {
          return;
        }

        aiHealthFailureCountRef.current = 0;
        setIsLlmAvailable(payload.enabled);
        setActiveAiProvider(payload.activeProvider);
        setActiveAiModel(payload.activeModel);
      } catch {
        if (isCancelled) {
          return;
        }

        aiHealthFailureCountRef.current += 1;
        if (aiHealthFailureCountRef.current >= failureThreshold) {
          setIsLlmAvailable(false);
          setActiveAiProvider(null);
          setActiveAiModel(null);
        }
      }
    }

    void loadAiHealth();
    const intervalId = window.setInterval(() => {
      void loadAiHealth();
    }, intervalMs);

    return () => {
      isCancelled = true;
      window.clearInterval(intervalId);
    };
  }, [apiBase, failureThreshold, intervalMs]);

  return {
    isLlmAvailable,
    activeAiProvider,
    activeAiModel
  };
}
