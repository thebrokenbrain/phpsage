// This component renders the dashboard top header and mode controls.
import type { ViewMode } from "../types.js";
import { AppIcon } from "./app-icon.js";

interface TopbarProps {
  issuesCount: number;
  isLlmAvailable: boolean | null;
  activeAiProvider: string | null;
  activeAiModel: string | null;
  isRunDetailLoading: boolean;
  viewMode: ViewMode;
  loading: boolean;
  onChangeViewMode: (mode: ViewMode) => void;
  onRun: () => void;
}

export function Topbar({
  issuesCount,
  isLlmAvailable,
  activeAiProvider,
  activeAiModel,
  isRunDetailLoading,
  viewMode,
  loading,
  onChangeViewMode,
  onRun
}: TopbarProps) {
  return (
    <header className="topbar">
      <div className="topbar-group">
        <div className="brand-group">
          <img className="product-logo" src="/logo/phpsage-logo.png" alt="PHPSage" />
        </div>
        <div className="header-metrics">
          <span className="metric-label">Errors</span>
          <span className="metric-value">{issuesCount}</span>
          {issuesCount > 0 && (
            <>
              <span className="metric-separator" />
              <span className="metric-label">LLM</span>
              <span className={`metric-badge ${isLlmAvailable ? "ok" : "off"}`}>
                {isLlmAvailable === null ? "..." : isLlmAvailable ? "ON" : "OFF"}
              </span>
              <span className="metric-detail">
                {activeAiProvider && activeAiModel ? `${activeAiProvider} · ${activeAiModel}` : "provider/model unknown"}
              </span>
            </>
          )}
        </div>
        {isRunDetailLoading && <span className="meta">syncing run…</span>}
      </div>

      <div className="topbar-group toolbar-group">
        <button className={viewMode === "dashboard" ? "active-tab" : ""} onClick={() => onChangeViewMode("dashboard")}>
          <AppIcon name="dashboard" />
          Dashboard
        </button>
        <button className={viewMode === "insights" ? "active-tab" : ""} onClick={() => onChangeViewMode("insights")}>
          <AppIcon name="insights" />
          Insights
        </button>
        <button className={viewMode === "issue" ? "active-tab" : ""} onClick={() => onChangeViewMode("issue")}>
          <AppIcon name="issue" />
          Issue
        </button>
        <button className="btn-primary" disabled={loading} onClick={onRun}>
          <AppIcon name="run" />
          Run
        </button>
      </div>
    </header>
  );
}
