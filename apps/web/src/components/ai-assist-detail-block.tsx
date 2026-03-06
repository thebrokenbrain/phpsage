import type { AiExplainPayload, AiSuggestFixPayload, RunIssue } from "../types.js";

interface AiAssistDetailBlockProps {
  activeIssue: RunIssue | null;
  isLlmAvailable: boolean | null;
  isAiLoading: boolean;
  aiError: string | null;
  aiExplain: AiExplainPayload | null;
  aiSuggestFix: AiSuggestFixPayload | null;
}

export function AiAssistDetailBlock({
  activeIssue,
  isLlmAvailable,
  isAiLoading,
  aiError,
  aiExplain,
  aiSuggestFix
}: AiAssistDetailBlockProps): JSX.Element {
  return (
    <section className="detail-block">
      <div className="detail-block-header">
        <h3>AI Assist</h3>
      </div>

      {!activeIssue ? <p className="empty">Select an issue to load AI assistance.</p> : null}
      {activeIssue && isLlmAvailable === null ? <p className="empty">Checking AI health...</p> : null}
      {activeIssue && isLlmAvailable === false ? <p className="empty">LLM is currently unavailable.</p> : null}
      {activeIssue && isLlmAvailable === true && isAiLoading ? <p className="empty">Loading AI assistance...</p> : null}
      {activeIssue && isLlmAvailable === true && aiError ? <p className="error">Could not load AI assistance: {aiError}</p> : null}

      {activeIssue && isLlmAvailable === true && !isAiLoading && !aiError && aiExplain ? (
        <>
          <p className="ai-meta">
            Explain source: {aiExplain.source} · provider: {aiExplain.provider}
          </p>
          {aiExplain.fallbackReason ? <p className="ai-meta">Explain fallback: {aiExplain.fallbackReason}</p> : null}
          <p>{aiExplain.explanation}</p>
          {aiExplain.recommendations.length > 0 ? (
            <ul className="detail-list">
              {aiExplain.recommendations.map((recommendation, recommendationIndex) => (
                <li key={`${recommendation}-${recommendationIndex}`}>{recommendation}</li>
              ))}
            </ul>
          ) : null}
        </>
      ) : null}

      {activeIssue && isLlmAvailable === true && !isAiLoading && !aiError && aiSuggestFix ? (
        <>
          <p className="ai-meta">
            Suggest source: {aiSuggestFix.source} · provider: {aiSuggestFix.provider}
          </p>
          {aiSuggestFix.fallbackReason ? <p className="ai-meta">Suggest fallback: {aiSuggestFix.fallbackReason}</p> : null}
          <p>{aiSuggestFix.rationale}</p>
          <pre className="source-preview ai-diff-preview">{aiSuggestFix.proposedDiff}</pre>
        </>
      ) : null}
    </section>
  );
}