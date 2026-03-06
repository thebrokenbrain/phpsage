import { useEffect } from "react";

const starterTargetStorageKey = "phpsage.runStarter.targetPath";
const autoRunSettingsStorageKey = "phpsage.dashboard.autoRun.settings";

interface UseDashboardStorageOptions {
  initialStartTargetPath: string | null;
  setStartRunTargetPath: (value: string | ((current: string) => string)) => void;
  isAutoRunEnabled: boolean;
  setIsAutoRunEnabled: (value: boolean | ((current: boolean) => boolean)) => void;
  autoRunIntervalMs: number;
  setAutoRunIntervalMs: (value: number | ((current: number) => number)) => void;
  autoRunTargetMode: "starter" | "selected";
  setAutoRunTargetMode: (value: "starter" | "selected" | ((current: "starter" | "selected") => "starter" | "selected")) => void;
  autoRunPauseWhenHidden: boolean;
  setAutoRunPauseWhenHidden: (value: boolean | ((current: boolean) => boolean)) => void;
  autoRunMaxFailures: number;
  setAutoRunMaxFailures: (value: number | ((current: number) => number)) => void;
  startRunTargetPath: string;
}

export function useDashboardStorage({
  initialStartTargetPath,
  setStartRunTargetPath,
  isAutoRunEnabled,
  setIsAutoRunEnabled,
  autoRunIntervalMs,
  setAutoRunIntervalMs,
  autoRunTargetMode,
  setAutoRunTargetMode,
  autoRunPauseWhenHidden,
  setAutoRunPauseWhenHidden,
  autoRunMaxFailures,
  setAutoRunMaxFailures,
  startRunTargetPath
}: UseDashboardStorageOptions): void {
  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (initialStartTargetPath) {
      return;
    }

    const storedTargetPath = window.localStorage.getItem(starterTargetStorageKey);
    if (storedTargetPath && storedTargetPath.trim().length > 0) {
      setStartRunTargetPath(storedTargetPath);
    }

    const searchParams = new URLSearchParams(window.location.search);
    const hasAutoQueryState =
      searchParams.has("auto") || searchParams.has("autoInterval") || searchParams.has("autoTarget") || searchParams.has("autoPauseHidden") || searchParams.has("autoMaxFailures");
    if (hasAutoQueryState) {
      return;
    }

    const storedAutoRunSettingsRaw = window.localStorage.getItem(autoRunSettingsStorageKey);
    if (!storedAutoRunSettingsRaw) {
      return;
    }

    try {
      const parsedSettings = JSON.parse(storedAutoRunSettingsRaw) as {
        isEnabled?: unknown;
        intervalMs?: unknown;
        targetMode?: unknown;
        pauseWhenHidden?: unknown;
        maxFailures?: unknown;
      };

      if (typeof parsedSettings.isEnabled === "boolean") {
        setIsAutoRunEnabled(parsedSettings.isEnabled);
      }

      if (typeof parsedSettings.intervalMs === "number" && Number.isFinite(parsedSettings.intervalMs) && parsedSettings.intervalMs > 0) {
        setAutoRunIntervalMs(parsedSettings.intervalMs);
      }

      if (parsedSettings.targetMode === "selected" || parsedSettings.targetMode === "starter") {
        setAutoRunTargetMode(parsedSettings.targetMode);
      }

      if (typeof parsedSettings.pauseWhenHidden === "boolean") {
        setAutoRunPauseWhenHidden(parsedSettings.pauseWhenHidden);
      }

      if (typeof parsedSettings.maxFailures === "number" && Number.isFinite(parsedSettings.maxFailures) && parsedSettings.maxFailures > 0) {
        setAutoRunMaxFailures(parsedSettings.maxFailures);
      }
    } catch {
      window.localStorage.removeItem(autoRunSettingsStorageKey);
    }
  }, [
    initialStartTargetPath,
    setAutoRunIntervalMs,
    setAutoRunMaxFailures,
    setAutoRunPauseWhenHidden,
    setAutoRunTargetMode,
    setIsAutoRunEnabled,
    setStartRunTargetPath
  ]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(starterTargetStorageKey, startRunTargetPath);
  }, [startRunTargetPath]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(
      autoRunSettingsStorageKey,
      JSON.stringify({
        isEnabled: isAutoRunEnabled,
        intervalMs: autoRunIntervalMs,
        targetMode: autoRunTargetMode,
        pauseWhenHidden: autoRunPauseWhenHidden,
        maxFailures: autoRunMaxFailures
      })
    );
  }, [autoRunIntervalMs, autoRunMaxFailures, autoRunPauseWhenHidden, autoRunTargetMode, isAutoRunEnabled]);
}