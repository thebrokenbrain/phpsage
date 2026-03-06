// This component renders issue detail and contextual AI assistance for the current issue.
import { AiAssistantPanel } from "../ai-assistant-panel.js";
import type { AiExplainResponse, AiSuggestFixResponse, RunIssue } from "../../types.js";

interface IssueDetailViewProps {
  hasIssues: boolean;
  activeIssue: RunIssue | null;
  aiExplain: AiExplainResponse | null;
  aiSuggestFix: AiSuggestFixResponse | null;
  isAiLoading: boolean;
  aiError: string | null;
}

export function IssueDetailView({
  hasIssues,
  activeIssue,
  aiExplain,
  aiSuggestFix,
  isAiLoading,
  aiError
}: IssueDetailViewProps): JSX.Element {
  return (
    <section className="card">
      <h3 className="section-title">Issue Detail</h3>
      {!hasIssues && <div className="meta">No issues available for the selected run.</div>}
      {hasIssues && !activeIssue && <div className="meta">No issue selected.</div>}
      {activeIssue && (
        <>
          <p><strong>File:</strong> {activeIssue.file}</p>
          <p><strong>Line:</strong> {activeIssue.line}</p>
          <p><strong>Message:</strong> {activeIssue.message}</p>
          <p>
            <strong>Identifier:</strong> {activeIssue.identifier ?? "-"}
            {activeIssue.identifier && (
              <>
                {" "}
                <a
                  href={`https://phpstan.org/error-identifiers/${activeIssue.identifier}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  open docs
                </a>
              </>
            )}
          </p>

          <AiAssistantPanel
            activeIssue={activeIssue}
            explain={aiExplain}
            suggestFix={aiSuggestFix}
            isLoading={isAiLoading}
            error={aiError}
          />
        </>
      )}
    </section>
  );
}
