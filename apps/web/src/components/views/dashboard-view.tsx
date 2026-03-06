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
  return (
    <>
      <section className="card">
        <h3 className="section-title">Run Summary</h3>
        <div className="kv-grid">
          <div>Run: {selectedRun?.runId ?? "-"}</div>
          <div>Status: {selectedRun?.status ?? "-"}</div>
          <div>Path: {selectedRun?.targetPath ?? "-"}</div>
          <div>Exit code: {selectedRun?.exitCode ?? "-"}</div>
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
