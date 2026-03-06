// This module centralizes small pure helpers used across App orchestration and hooks.
import type { RunIssue } from "../types.js";

export function formatError(value: unknown): string {
  if (value instanceof Error) {
    return value.message;
  }

  return String(value);
}

export function getIssueKey(issue: RunIssue): string {
  return `${issue.file}::${issue.line}::${issue.message}`;
}

export function getIssueContextKey(issue: RunIssue): string {
  return `${issue.file}::${issue.line}::${issue.message}::${issue.identifier ?? "unknown"}`;
}

export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  const tagName = target.tagName.toLowerCase();
  if (tagName === "input" || tagName === "textarea" || tagName === "select") {
    return true;
  }

  return target.isContentEditable;
}
