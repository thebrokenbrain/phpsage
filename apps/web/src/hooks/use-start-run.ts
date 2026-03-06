import { useState } from "react";
import type { StartRunPayload } from "../types.js";
import { formatError } from "../utils/app-helpers.js";

interface UseStartRunOptions {
  apiBaseUrl: string;
  startRunTargetPath: string;
  autoRunEffectiveIntervalMs: number;
  autoRunMaxFailures: number;
  setSelectedRunId: (value: string | null | ((current: string | null) => string | null)) => void;
  refreshRuns: () => Promise<void>;
  setAutoRunCountdownSec: (value: number | ((current: number) => number)) => void;
  setLastAutoRunError: (value: string | null | ((current: string | null) => string | null)) => void;
  setAutoRunFailureCount: (value: number | ((current: number) => number)) => void;
  setAutoRunConsecutiveFailures: (value: number | ((current: number) => number)) => void;
  setAutoRunDisabledReason: (value: string | null | ((current: string | null) => string | null)) => void;
  setIsAutoRunEnabled: (value: boolean | ((current: boolean) => boolean)) => void;
}

interface UseStartRunResult {
  startRunLoading: boolean;
  startRunError: string | null;
  setStartRunError: (value: string | null | ((current: string | null) => string | null)) => void;
  startRunFromUi: (targetPathOverride?: string, triggerSource?: "manual" | "auto") => Promise<boolean>;
}

export function useStartRun({
  apiBaseUrl,
  startRunTargetPath,
  autoRunEffectiveIntervalMs,
  autoRunMaxFailures,
  setSelectedRunId,
  refreshRuns,
  setAutoRunCountdownSec,
  setLastAutoRunError,
  setAutoRunFailureCount,
  setAutoRunConsecutiveFailures,
  setAutoRunDisabledReason,
  setIsAutoRunEnabled
}: UseStartRunOptions): UseStartRunResult {
  const [startRunLoading, setStartRunLoading] = useState(false);
  const [startRunError, setStartRunError] = useState<string | null>(null);

  async function startRunFromUi(targetPathOverride?: string, triggerSource: "manual" | "auto" = "manual"): Promise<boolean> {
    const normalizedTargetPath = (targetPathOverride ?? startRunTargetPath).trim();
    if (normalizedTargetPath.length === 0) {
      setStartRunError("Target path is required.");
      return false;
    }

    setStartRunLoading(true);
    setStartRunError(null);

    try {
      const response = await fetch(`${apiBaseUrl}/api/runs/start`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          targetPath: normalizedTargetPath,
          execute: true
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const payload = (await response.json()) as StartRunPayload;
      setSelectedRunId(payload.runId);
      setAutoRunCountdownSec(Math.ceil(autoRunEffectiveIntervalMs / 1000));
      setLastAutoRunError(null);
      if (triggerSource === "auto") {
        setAutoRunFailureCount(0);
        setAutoRunConsecutiveFailures(0);
        setAutoRunDisabledReason(null);
      }
      await refreshRuns();
      return true;
    } catch (startError) {
      const message = formatError(startError);
      setStartRunError(message);
      if (triggerSource === "auto") {
        setLastAutoRunError(message);
        setAutoRunFailureCount((currentValue) => currentValue + 1);
        setAutoRunConsecutiveFailures((currentValue) => {
          const nextValue = currentValue + 1;
          if (nextValue >= autoRunMaxFailures) {
            setAutoRunDisabledReason("max auto failures reached");
            setIsAutoRunEnabled(false);
          } else {
            setAutoRunDisabledReason("auto-start failed (backoff active)");
          }
          return nextValue;
        });
      }
      return false;
    } finally {
      setStartRunLoading(false);
    }
  }

  return {
    startRunLoading,
    startRunError,
    setStartRunError,
    startRunFromUi
  };
}