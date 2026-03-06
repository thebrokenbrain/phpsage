// This component renders dashboard-specific run summary, code viewer, and AI panel.
import { AiAssistantPanel } from "../ai-assistant-panel.js";
import { CodeWindow, type FileIssueViewItem } from "../code-window.js";
import type { AiExplainResponse, AiSuggestFixResponse, RunIssue, RunRecord } from "../../types.js";

interface DashboardViewProps {
  selectedRun: RunRecord | null;
  selectedFilePath: string | null;
  activeSourceError: string | null;
  activeIssueForViewer: RunIssue | null;
  activeIssueIndexForViewer: number | null;
  fileIssuesForViewer: FileIssueViewItem[];
  activeSourceContent: string | null;
  onSelectIssueInFile: (issueIndex: number) => void;
  aiExplain: AiExplainResponse | null;
  aiSuggestFix: AiSuggestFixResponse | null;
  isAiLoading: boolean;
  aiError: string | null;
}

export function DashboardView({
  selectedRun,
  selectedFilePath,
  activeSourceError,
  activeIssueForViewer,
  activeIssueIndexForViewer,
  fileIssuesForViewer,
  activeSourceContent,
  onSelectIssueInFile,
  aiExplain,
  aiSuggestFix,
  isAiLoading,
  aiError
}: DashboardViewProps): JSX.Element {
  const exitCode = selectedRun?.exitCode;
  const hasExitCode = typeof exitCode === "number";
  const isSuccessExit = exitCode === 0;

  let exitCodeMessage = "Waiting for analysis result.";
  if (hasExitCode) {
    if (exitCode === 0) {
      exitCodeMessage = "PHPStan finished successfully with no reported issues.";
    } else if (exitCode === 1) {
      exitCodeMessage = "PHPStan reported errors. Review the issues below.";
    } else if (exitCode === 124) {
      exitCodeMessage = "PHPStan timed out before finishing the analysis.";
    } else {
      exitCodeMessage = "PHPStan ended with an execution error.";
    }
  }

  return (
    <>
      <section className="card">
        <h3 className="section-title">Run Summary</h3>
        <div className="kv-grid">
          <div>Run: {selectedRun?.runId ?? "-"}</div>
          <div>Status: {selectedRun?.status ?? "-"}</div>
          <div>Path: {selectedRun?.targetPath ?? "-"}</div>
          <div className={`exit-code-summary ${hasExitCode && isSuccessExit ? "ok" : "error"}`}>
            <strong>Exit code: {hasExitCode ? exitCode : "-"}</strong>
            <span>{exitCodeMessage}</span>
          </div>
        </div>
      </section>

      <section className="code-viewer">
        <div className="code-header">{selectedFilePath ?? "No file selected"}</div>
        {selectedFilePath && activeSourceError ? (
          <div className="card">{activeSourceError}</div>
        ) : selectedFilePath ? (
          <CodeWindow
            issue={activeIssueForViewer}
            activeIssueIndex={activeIssueIndexForViewer}
            fileIssues={fileIssuesForViewer}
            sourceContent={activeSourceContent}
            onSelectIssue={onSelectIssueInFile}
          />
        ) : (
          <div className="card">No issues available for the selected run.</div>
        )}
      </section>

      {activeIssueForViewer && (
        <AiAssistantPanel
          activeIssue={activeIssueForViewer}
          explain={aiExplain}
          suggestFix={aiSuggestFix}
          isLoading={isAiLoading}
          error={aiError}
        />
      )}
    </>
  );
}
