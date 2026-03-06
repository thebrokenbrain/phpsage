// This module provides path normalization and file tree helpers used by run explorer/navigation.
import type { RunFileEntry } from "../types.js";

export interface RunFileTreeRow {
  readonly key: string;
  readonly depth: number;
  readonly type: "directory" | "file";
  readonly label: string;
  readonly path: string;
  readonly hasIssues: boolean;
  readonly issueCount: number;
}

export function toRelativeRunPath(targetPath: string, filePath: string): string {
  const normalizedTarget = normalizePath(targetPath).replace(/\/+$/, "");
  const normalizedFile = normalizePath(filePath);

  if (normalizedFile.startsWith(`${normalizedTarget}/`)) {
    return normalizedFile.slice(normalizedTarget.length + 1);
  }

  if (normalizedFile === normalizedTarget) {
    return "";
  }

  return normalizedFile.replace(/^\/+/, "");
}

export function toAbsoluteRunPath(targetPath: string, filePath: string): string {
  const normalizedTarget = normalizePath(targetPath).replace(/\/+$/, "");
  const normalizedFile = normalizePath(filePath);
  if (normalizedFile.startsWith("/")) {
    return normalizedFile;
  }

  return `${normalizedTarget}/${normalizedFile}`;
}

function normalizePath(path: string): string {
  return path.replace(/\\/g, "/").replace(/\/+/g, "/");
}

export function isTreeRowVisible(row: RunFileTreeRow, collapsedDirectories: Set<string>): boolean {
  return !hasCollapsedAncestor(row.path, collapsedDirectories);
}

export function getParentDirectoryPaths(filePath: string): string[] {
  const normalizedPath = normalizePath(filePath);
  const segments = normalizedPath.split("/").filter(Boolean);
  const parentDirectories: string[] = [];
  let currentPath = "";

  for (let index = 0; index < segments.length - 1; index += 1) {
    currentPath = currentPath ? `${currentPath}/${segments[index]}` : segments[index];
    parentDirectories.push(currentPath);
  }

  return parentDirectories;
}

export function isPathDescendantOf(path: string, basePath: string): boolean {
  const normalizedPath = normalizePath(path).replace(/\/$/, "");
  const normalizedBasePath = normalizePath(basePath).replace(/\/$/, "");
  if (!normalizedPath || !normalizedBasePath || normalizedPath === normalizedBasePath) {
    return false;
  }

  return normalizedPath.startsWith(`${normalizedBasePath}/`);
}

export function buildFileTreeRows(files: RunFileEntry[]): RunFileTreeRow[] {
  const directorySet = new Set<string>();
  const rows: RunFileTreeRow[] = [];

  for (const file of files) {
    const segments = file.path.split("/").filter(Boolean);
    let currentPath = "";

    for (let index = 0; index < segments.length - 1; index += 1) {
      currentPath = currentPath ? `${currentPath}/${segments[index]}` : segments[index];
      if (!directorySet.has(currentPath)) {
        directorySet.add(currentPath);
        rows.push({
          key: `dir:${currentPath}`,
          depth: index,
          type: "directory",
          label: segments[index],
          path: currentPath,
          hasIssues: false,
          issueCount: 0
        });
      }
    }

    rows.push({
      key: `file:${file.path}`,
      depth: Math.max(segments.length - 1, 0),
      type: "file",
      label: segments[segments.length - 1] ?? file.path,
      path: file.path,
      hasIssues: file.hasIssues,
      issueCount: file.issueCount
    });
  }

  rows.sort((left, right) => {
    if (left.path === right.path) {
      if (left.type === right.type) {
        return 0;
      }

      return left.type === "directory" ? -1 : 1;
    }

    return left.path.localeCompare(right.path);
  });

  return rows;
}

function hasCollapsedAncestor(path: string, collapsedDirectories: Set<string>): boolean {
  if (collapsedDirectories.size === 0) {
    return false;
  }

  for (const collapsedPath of collapsedDirectories) {
    if (collapsedPath !== path && isPathDescendantOf(path, collapsedPath)) {
      return true;
    }
  }

  return false;
}
