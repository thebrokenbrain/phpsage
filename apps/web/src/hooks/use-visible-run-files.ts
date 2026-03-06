import { useMemo } from "react";
import type { RunFileItem } from "../types.js";

interface UseVisibleRunFilesOptions {
  fileSearchTerm: string;
  runFiles: RunFileItem[];
}

export function useVisibleRunFiles({ fileSearchTerm, runFiles }: UseVisibleRunFilesOptions): RunFileItem[] {
  return useMemo(() => {
    const normalizedTerm = fileSearchTerm.trim().toLowerCase();
    if (normalizedTerm.length === 0) {
      return runFiles;
    }

    return runFiles.filter((fileEntry) => fileEntry.path.toLowerCase().includes(normalizedTerm));
  }, [fileSearchTerm, runFiles]);
}