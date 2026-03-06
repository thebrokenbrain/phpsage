import { useEffect } from "react";
import type { RunRecord } from "../types.js";

interface UseSelectedSourceFileGuardOptions {
  selectedRun: RunRecord | null;
  setSelectedSourceFilePath: (value: string | null | ((current: string | null) => string | null)) => void;
}

export function useSelectedSourceFileGuard({
  selectedRun,
  setSelectedSourceFilePath
}: UseSelectedSourceFileGuardOptions): void {
  useEffect(() => {
    if (!selectedRun) {
      return;
    }

    setSelectedSourceFilePath((currentPath) => {
      if (!currentPath) {
        return null;
      }

      return currentPath.startsWith(`${selectedRun.targetPath}/`) ? currentPath : null;
    });
  }, [selectedRun, setSelectedSourceFilePath]);
}