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

export function filterDuplicateAiRecommendations(explanation: string, recommendations: string[]): string[] {
  const normalizedExplanation = normalizeAiComparisonText(explanation);

  return recommendations.filter((recommendation, index) => {
    const normalizedRecommendation = normalizeAiComparisonText(recommendation);
    if (normalizedRecommendation.length === 0) {
      return false;
    }

    if (normalizedExplanation.includes(normalizedRecommendation)) {
      return false;
    }

    return recommendations.findIndex((candidate) => normalizeAiComparisonText(candidate) === normalizedRecommendation) === index;
  });
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

function normalizeAiComparisonText(value: string): string {
  return value
    .replace(/\r\n/g, "\n")
    .replace(/^[\s>*-]+/gm, "")
    .replace(/[`*_]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}
