// This hook handles keyboard-based issue navigation for dashboard mode.
import { useEffect } from "react";
import type { ViewMode } from "../types.js";
import { isEditableTarget } from "../utils/app-helpers.js";

interface UseKeyboardIssueNavigationOptions {
  viewMode: ViewMode;
  issuesLength: number;
  safeIssueIndex: number;
  onSelectIssueByIndex: (nextIndex: number) => void;
}

export function useKeyboardIssueNavigation({
  viewMode,
  issuesLength,
  safeIssueIndex,
  onSelectIssueByIndex
}: UseKeyboardIssueNavigationOptions): void {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (viewMode !== "dashboard" || issuesLength === 0) {
        return;
      }

      if (isEditableTarget(event.target)) {
        return;
      }

      if (event.key === "j") {
        event.preventDefault();
        onSelectIssueByIndex(safeIssueIndex + 1);
        return;
      }

      if (event.key === "k") {
        event.preventDefault();
        onSelectIssueByIndex(safeIssueIndex - 1);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [viewMode, issuesLength, safeIssueIndex, onSelectIssueByIndex]);
}
