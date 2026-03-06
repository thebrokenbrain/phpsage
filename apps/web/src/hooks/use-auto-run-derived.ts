import { useMemo } from "react";
import type { RunRecord } from "../types.js";

interface UseAutoRunDerivedOptions {
  autoRunTargetMode: "starter" | "selected";
  selectedRun: RunRecord | null;
  startRunTargetPath: string;
  autoRunConsecutiveFailures: number;
  autoRunIntervalMs: number;
}

interface UseAutoRunDerivedResult {
  resolvedAutoRunTargetPath: string;
  isAutoRunUsingStarterFallback: boolean;
  autoRunEffectiveIntervalMs: number;
}

export function useAutoRunDerived({
  autoRunTargetMode,
  selectedRun,
  startRunTargetPath,
  autoRunConsecutiveFailures,
  autoRunIntervalMs
}: UseAutoRunDerivedOptions): UseAutoRunDerivedResult {
  const resolvedAutoRunTargetPath = useMemo(() => {
    return autoRunTargetMode === "selected"
      ? (selectedRun?.targetPath ?? startRunTargetPath)
      : startRunTargetPath;
  }, [autoRunTargetMode, selectedRun, startRunTargetPath]);

  const isAutoRunUsingStarterFallback = useMemo(() => {
    return autoRunTargetMode === "selected" && !selectedRun;
  }, [autoRunTargetMode, selectedRun]);

  const autoRunEffectiveIntervalMs = useMemo(() => {
    const multiplier = 1 + Math.min(autoRunConsecutiveFailures, 4);
    return autoRunIntervalMs * multiplier;
  }, [autoRunConsecutiveFailures, autoRunIntervalMs]);

  return {
    resolvedAutoRunTargetPath,
    isAutoRunUsingStarterFallback,
    autoRunEffectiveIntervalMs
  };
}