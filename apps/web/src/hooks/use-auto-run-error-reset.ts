import { useEffect } from "react";

interface UseAutoRunErrorResetOptions {
  autoRunIntervalMs: number;
  autoRunMaxFailures: number;
  autoRunPauseWhenHidden: boolean;
  autoRunTargetMode: "starter" | "selected";
  setLastAutoRunError: (value: string | null | ((current: string | null) => string | null)) => void;
}

export function useAutoRunErrorReset({
  autoRunIntervalMs,
  autoRunMaxFailures,
  autoRunPauseWhenHidden,
  autoRunTargetMode,
  setLastAutoRunError
}: UseAutoRunErrorResetOptions): void {
  useEffect(() => {
    setLastAutoRunError(null);
  }, [autoRunIntervalMs, autoRunMaxFailures, autoRunPauseWhenHidden, autoRunTargetMode, setLastAutoRunError]);
}