import { useEffect } from "react";
import type { RunSummary } from "../types.js";

interface UseAutoRunSchedulerOptions {
  isAutoRunEnabled: boolean;
  autoRunPauseWhenHidden: boolean;
  autoRunEffectiveIntervalMs: number;
  resolvedAutoRunTargetPath: string;
  runs: RunSummary[];
  startRunLoading: boolean;
  setLastAutoRunAt: (value: string | null | ((current: string | null) => string | null)) => void;
  setAutoRunTriggerCount: (value: number | ((current: number) => number)) => void;
  startRunFromUi: (targetPathOverride?: string, triggerSource?: "manual" | "auto") => Promise<boolean>;
}

export function useAutoRunScheduler({
  isAutoRunEnabled,
  autoRunPauseWhenHidden,
  autoRunEffectiveIntervalMs,
  resolvedAutoRunTargetPath,
  runs,
  startRunLoading,
  setLastAutoRunAt,
  setAutoRunTriggerCount,
  startRunFromUi
}: UseAutoRunSchedulerOptions): void {
  useEffect(() => {
    if (!isAutoRunEnabled) {
      return;
    }

    const intervalId = window.setInterval(() => {
      if (autoRunPauseWhenHidden && typeof document !== "undefined" && document.visibilityState === "hidden") {
        return;
      }

      if (resolvedAutoRunTargetPath.trim().length === 0) {
        return;
      }

      const hasRunningRun = runs.some((run) => run.status === "running");
      if (hasRunningRun || startRunLoading) {
        return;
      }

      void (async () => {
        const didStart = await startRunFromUi(resolvedAutoRunTargetPath, "auto");
        if (didStart) {
          setLastAutoRunAt(new Date().toISOString());
          setAutoRunTriggerCount((currentValue) => currentValue + 1);
        }
      })();
    }, autoRunEffectiveIntervalMs);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [
    autoRunEffectiveIntervalMs,
    autoRunPauseWhenHidden,
    isAutoRunEnabled,
    resolvedAutoRunTargetPath,
    runs,
    setAutoRunTriggerCount,
    setLastAutoRunAt,
    startRunFromUi,
    startRunLoading
  ]);
}