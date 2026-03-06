// This module handles URL <-> UI state mapping for run, issue, and view mode.
import type { ViewMode } from "../types.js";

interface UrlUiState {
  readonly runId: string | null;
  readonly issueIndex: number;
  readonly viewMode: ViewMode;
}

export function parseUiStateFromUrl(): UrlUiState {
  const params = new URLSearchParams(window.location.search);
  const runId = params.get("runId");
  const issueParam = params.get("issue");
  const viewParam = params.get("view");

  const issueIndex = issueParam && /^\d+$/.test(issueParam) ? Number.parseInt(issueParam, 10) : 0;
  const viewMode = isViewMode(viewParam) ? viewParam : "dashboard";

  return {
    runId: runId && runId.trim().length > 0 ? runId : null,
    issueIndex,
    viewMode
  };
}

export function syncUiStateToUrl(state: {
  runId: string | null;
  issueIndex: number;
  viewMode: ViewMode;
  hasIssues: boolean;
}): void {
  const params = new URLSearchParams();

  if (state.runId) {
    params.set("runId", state.runId);
  }

  params.set("view", state.viewMode);

  if (state.runId && state.hasIssues) {
    params.set("issue", String(state.issueIndex));
  }

  const query = params.toString();
  const nextUrl = query.length > 0 ? `${window.location.pathname}?${query}` : window.location.pathname;

  if (window.location.search !== (query.length > 0 ? `?${query}` : "")) {
    window.history.replaceState(null, "", nextUrl);
  }
}

function isViewMode(value: string | null): value is ViewMode {
  return value === "dashboard" || value === "insights" || value === "issue";
}
