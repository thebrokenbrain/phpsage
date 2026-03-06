import { useEffect, useState } from "react";

interface UseAutoRunCountdownOptions {
  isAutoRunEnabled: boolean;
  effectiveIntervalMs: number;
}

interface UseAutoRunCountdownResult {
  autoRunCountdownSec: number;
  setAutoRunCountdownSec: (value: number | ((current: number) => number)) => void;
}

export function useAutoRunCountdown({ isAutoRunEnabled, effectiveIntervalMs }: UseAutoRunCountdownOptions): UseAutoRunCountdownResult {
  const [autoRunCountdownSec, setAutoRunCountdownSec] = useState(Math.ceil(effectiveIntervalMs / 1000));

  useEffect(() => {
    setAutoRunCountdownSec(Math.ceil(effectiveIntervalMs / 1000));
  }, [effectiveIntervalMs]);

  useEffect(() => {
    if (!isAutoRunEnabled) {
      setAutoRunCountdownSec(Math.ceil(effectiveIntervalMs / 1000));
      return;
    }

    const timerId = window.setInterval(() => {
      setAutoRunCountdownSec((currentValue) => {
        if (currentValue <= 1) {
          return Math.ceil(effectiveIntervalMs / 1000);
        }

        return currentValue - 1;
      });
    }, 1000);

    return () => {
      window.clearInterval(timerId);
    };
  }, [effectiveIntervalMs, isAutoRunEnabled]);

  return {
    autoRunCountdownSec,
    setAutoRunCountdownSec
  };
}
