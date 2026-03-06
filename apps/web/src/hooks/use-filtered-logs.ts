import { useMemo } from "react";
import type { RunLogEntry, RunRecord } from "../types.js";

interface UseFilteredLogsOptions {
  selectedRun: RunRecord | null;
  logSearchTerm: string;
  logStreamFilter: "all" | "stdout" | "stderr";
}

export function useFilteredLogs({ selectedRun, logSearchTerm, logStreamFilter }: UseFilteredLogsOptions): RunLogEntry[] {
  return useMemo(() => {
    if (!selectedRun) {
      return [];
    }

    const normalizedSearchTerm = logSearchTerm.trim().toLowerCase();

    return selectedRun.logs.filter((logEntry) => {
      if (logStreamFilter !== "all" && logEntry.stream !== logStreamFilter) {
        return false;
      }

      if (normalizedSearchTerm.length === 0) {
        return true;
      }

      return `${logEntry.stream} ${logEntry.message}`.toLowerCase().includes(normalizedSearchTerm);
    });
  }, [logSearchTerm, logStreamFilter, selectedRun]);
}