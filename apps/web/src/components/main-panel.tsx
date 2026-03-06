// This component renders the main content area: toolbar, status cards, and view-specific sections.
import { MainToolbar } from "./main-toolbar.js";
import { DashboardView } from "./views/dashboard-view.js";
import { InsightsView } from "./views/insights-view.js";
import { IssueDetailView } from "./views/issue-detail-view.js";
import type { FileIssueViewItem } from "./code-window.js";
import type { AiExplainResponse, AiSuggestFixResponse, RunIssue, RunRecord, ViewMode } from "../types.js";

interface MainPanelProps {
  hasSelectedRun: boolean;
  hasRuns: boolean;
  hasIssues: boolean;
  viewMode: ViewMode;
  safeIssueIndex: number;
  issuesLength: number;
  selectedFilePath: string | null;
  selectedRun: RunRecord | null;
  runFilesLength: number;
  currentFilePosition: number;
  error: string | null;
  activeSourceError: string | null;
  activeIssue: RunIssue | null;
  activeIssueForViewer: RunIssue | null;
  activeIssueIndexForViewer: number | null;
  fileIssuesForViewer: FileIssueViewItem[];
  activeSourceContent: string | null;
  identifiers: Array<[string, number]>;
  aiExplain: AiExplainResponse | null;
  aiSuggestFix: AiSuggestFixResponse | null;
  isAiLoading: boolean;
  aiError: string | null;
  onPrevIssue: () => void;
  onNextIssue: () => void;
  onSelectIssueInFile: (issueIndex: number) => void;
}

export function MainPanel({
  hasSelectedRun,
  hasRuns,
  hasIssues,
  viewMode,
  safeIssueIndex,
  issuesLength,
  selectedFilePath,
  selectedRun,
  runFilesLength,
  currentFilePosition,
  error,
  activeSourceError,
  activeIssue,
  activeIssueForViewer,
  activeIssueIndexForViewer,
  fileIssuesForViewer,
  activeSourceContent,
  identifiers,
  aiExplain,
  aiSuggestFix,
  isAiLoading,
  aiError,
  onPrevIssue,
  onNextIssue,
  onSelectIssueInFile
}: MainPanelProps): JSX.Element {
  return (
    <main className="mainpanel">
      {hasSelectedRun && (
        <MainToolbar
          canGoPrev={safeIssueIndex > 0}
          canGoNext={issuesLength > 0 && safeIssueIndex < issuesLength - 1}
          mainPath={selectedFilePath ?? selectedRun?.targetPath ?? "No file selected"}
          currentFilePosition={currentFilePosition}
          totalFiles={runFilesLength}
          currentErrorPosition={issuesLength > 0 ? safeIssueIndex + 1 : 0}
          totalErrors={issuesLength}
          onPrev={onPrevIssue}
          onNext={onNextIssue}
        />
      )}

      {error && <div className="card">Error: {error}</div>}

      {!hasRuns && (
        <section className="card">
          <h3 className="section-title">No runs available</h3>
          <div className="meta">Use Run to start a new analysis and populate this view.</div>
        </section>
      )}

      {hasRuns && !hasSelectedRun && (
        <section className="card">
          <h3 className="section-title">Loading run detail</h3>
          <div className="meta">Waiting for selected run data…</div>
        </section>
      )}

      {viewMode === "dashboard" && hasSelectedRun && (
        <DashboardView
          selectedRun={selectedRun}
          selectedFilePath={selectedFilePath}
          activeSourceError={activeSourceError}
          activeIssueForViewer={activeIssueForViewer}
          activeIssueIndexForViewer={activeIssueIndexForViewer}
          fileIssuesForViewer={fileIssuesForViewer}
          activeSourceContent={activeSourceContent}
          onSelectIssueInFile={onSelectIssueInFile}
          aiExplain={aiExplain}
          aiSuggestFix={aiSuggestFix}
          isAiLoading={isAiLoading}
          aiError={aiError}
        />
      )}

      {viewMode === "insights" && hasSelectedRun && (
        <InsightsView identifiers={identifiers} />
      )}

      {viewMode === "issue" && hasSelectedRun && (
        <IssueDetailView
          hasIssues={hasIssues}
          activeIssue={activeIssue}
          aiExplain={aiExplain}
          aiSuggestFix={aiSuggestFix}
          isAiLoading={isAiLoading}
          aiError={aiError}
        />
      )}
    </main>
  );
}
