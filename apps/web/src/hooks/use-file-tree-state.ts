// This hook encapsulates file tree derivations and file/collapse synchronization behavior.
import { useEffect, useMemo, useRef } from "react";
import type { RunFileEntry, RunRecord } from "../types.js";
import {
  buildFileTreeRows,
  getParentDirectoryPaths,
  isPathDescendantOf,
  isTreeRowVisible,
  type RunFileTreeRow
} from "../utils/run-file-tree.js";

interface UseFileTreeStateOptions {
  selectedRun: RunRecord | null;
  selectedRunId: string | null;
  runFiles: RunFileEntry[];
  selectedFilePath: string | null;
  activeIssueRelativePath: string | null;
  collapsedDirectories: Set<string>;
  onSetSelectedFilePath: (filePath: string | null) => void;
  onSetCollapsedDirectories: (value: Set<string> | ((currentValue: Set<string>) => Set<string>)) => void;
}

interface UseFileTreeStateResult {
  fileTreeRows: RunFileTreeRow[];
  visibleFileTreeRows: RunFileTreeRow[];
  currentFilePosition: number;
  handleToggleDirectory: (path: string) => void;
}

export function computeCurrentFilePosition(fileTreeRows: RunFileTreeRow[], selectedFilePath: string | null): number {
  if (!selectedFilePath) {
    return 0;
  }

  return Math.max(fileTreeRows.filter((row) => row.type === "file").findIndex((row) => row.path === selectedFilePath) + 1, 1);
}

export function getExpandedDirectoriesForSelectedFile(currentValue: Set<string>, selectedFilePath: string): Set<string> {
  if (currentValue.size === 0) {
    return currentValue;
  }

  const nextValue = new Set(currentValue);
  for (const directoryPath of getParentDirectoryPaths(selectedFilePath)) {
    nextValue.delete(directoryPath);
  }

  return nextValue.size === currentValue.size ? currentValue : nextValue;
}

export function toggleDirectoryCollapsedState(currentValue: Set<string>, path: string): Set<string> {
  const nextValue = new Set(currentValue);
  if (nextValue.has(path)) {
    nextValue.delete(path);
    for (const directoryPath of Array.from(nextValue)) {
      if (isPathDescendantOf(directoryPath, path)) {
        nextValue.delete(directoryPath);
      }
    }
  } else {
    nextValue.add(path);
  }

  return nextValue;
}

export function useFileTreeState({
  selectedRun,
  selectedRunId,
  runFiles,
  selectedFilePath,
  activeIssueRelativePath,
  collapsedDirectories,
  onSetSelectedFilePath,
  onSetCollapsedDirectories
}: UseFileTreeStateOptions): UseFileTreeStateResult {
  const previousRunIdRef = useRef<string | null>(null);

  const fileTreeRows = useMemo(() => buildFileTreeRows(runFiles), [runFiles]);
  const visibleFileTreeRows = useMemo(
    () => fileTreeRows.filter((row) => isTreeRowVisible(row, collapsedDirectories)),
    [fileTreeRows, collapsedDirectories]
  );
  const currentFilePosition = useMemo(
    () => computeCurrentFilePosition(fileTreeRows, selectedFilePath),
    [fileTreeRows, selectedFilePath]
  );

  useEffect(() => {
    if (!selectedRun || runFiles.length === 0) {
      if (!selectedRun) {
        onSetSelectedFilePath(null);
        previousRunIdRef.current = null;
      }
      return;
    }

    const hasSelectedFile = !!selectedFilePath && runFiles.some((file) => file.path === selectedFilePath);
    const hasIssueFile = !!activeIssueRelativePath && runFiles.some((file) => file.path === activeIssueRelativePath);
    const runChanged = previousRunIdRef.current !== selectedRun.runId;
    previousRunIdRef.current = selectedRun.runId;

    if (runChanged) {
      if (hasIssueFile) {
        onSetSelectedFilePath(activeIssueRelativePath);
        return;
      }

      onSetSelectedFilePath(runFiles[0].path);
      return;
    }

    if (!hasSelectedFile) {
      onSetSelectedFilePath(runFiles[0].path);
    }
  }, [activeIssueRelativePath, onSetSelectedFilePath, runFiles, selectedFilePath, selectedRun]);

  useEffect(() => {
    onSetCollapsedDirectories(new Set());
  }, [onSetCollapsedDirectories, selectedRunId]);

  useEffect(() => {
    if (!selectedFilePath) {
      return;
    }

    onSetCollapsedDirectories((currentValue) => {
      return getExpandedDirectoriesForSelectedFile(currentValue, selectedFilePath);
    });
  }, [onSetCollapsedDirectories, selectedFilePath]);

  const handleToggleDirectory = (path: string): void => {
    onSetCollapsedDirectories((currentValue) => {
      return toggleDirectoryCollapsedState(currentValue, path);
    });
  };

  return {
    fileTreeRows,
    visibleFileTreeRows,
    currentFilePosition,
    handleToggleDirectory
  };
}
