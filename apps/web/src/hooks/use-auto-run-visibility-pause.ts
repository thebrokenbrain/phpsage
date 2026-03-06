import { useEffect } from "react";

interface UseAutoRunVisibilityPauseOptions {
  isAutoRunEnabled: boolean;
  autoRunPauseWhenHidden: boolean;
  autoRunEffectiveIntervalMs: number;
  setAutoRunDisabledReason: (value: string | null | ((current: string | null) => string | null)) => void;
  setAutoRunCountdownSec: (value: number | ((current: number) => number)) => void;
}

export function useAutoRunVisibilityPause({
  isAutoRunEnabled,
  autoRunPauseWhenHidden,
  autoRunEffectiveIntervalMs,
  setAutoRunDisabledReason,
  setAutoRunCountdownSec
}: UseAutoRunVisibilityPauseOptions): void {
  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }

    if (!isAutoRunEnabled || !autoRunPauseWhenHidden) {
      return;
    }

    function handleVisibilityChange(): void {
      if (document.visibilityState === "hidden") {
        setAutoRunDisabledReason("page hidden (auto paused)");
        return;
      }

      setAutoRunDisabledReason((currentValue) => {
        if (currentValue === "page hidden (auto paused)") {
          return null;
        }

        return currentValue;
      });
      setAutoRunCountdownSec(Math.ceil(autoRunEffectiveIntervalMs / 1000));
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [
    autoRunEffectiveIntervalMs,
    autoRunPauseWhenHidden,
    isAutoRunEnabled,
    setAutoRunCountdownSec,
    setAutoRunDisabledReason
  ]);
}