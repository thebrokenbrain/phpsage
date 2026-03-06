import { useEffect, useState, type ReactNode } from "react";
import type { AiExplainResponse, AiLlmDebugPayload, AiSuggestFixResponse, AiUsage, RunIssue } from "../types.js";

interface AiAssistantPanelProps {
  activeIssue: RunIssue | null;
  explain: AiExplainResponse | null;
  suggestFix: AiSuggestFixResponse | null;
  isLoading: boolean;
  error: string | null;
}

export function AiAssistantPanel({
  activeIssue,
  explain,
  suggestFix,
  isLoading,
  error
}: AiAssistantPanelProps) {
  const [showDebugPayloads, setShowDebugPayloads] = useState(false);
  const hasDebugPayloads = Boolean(explain?.debug || suggestFix?.debug);

  useEffect(() => {
    if (!hasDebugPayloads) {
      setShowDebugPayloads(false);
    }
  }, [hasDebugPayloads]);

  return (
    <section className="card ai-card">
      <div className="ai-header">
        <h3 className="section-title ai-title">
          <span className="ai-robot" aria-hidden="true">🤖</span>
          AI Assist
        </h3>
        <span className="ai-state">{activeIssue ? "Issue Context Loaded" : "Waiting Issue"}</span>
      </div>

      {activeIssue && hasDebugPayloads && (
        <div className="ai-debug-toggle-row">
          <label className="ai-debug-toggle">
            <input
              type="checkbox"
              checked={showDebugPayloads}
              onChange={(event) => setShowDebugPayloads(event.target.checked)}
            />
            <span>Debug LLM I/O</span>
          </label>
        </div>
      )}

      {!activeIssue && <div className="meta">Select an issue to load explain/suggest-fix.</div>}
      {activeIssue && isLoading && (
        <div className="ai-loading-shell" aria-live="polite" aria-busy="true">
          <div className="ai-loading-head">
            <span className="ai-spinner" aria-hidden="true" />
            <span className="ai-loading-label">Thinking and drafting suggestions…</span>
          </div>
          <div className="ai-skeleton-block">
            <div className="ai-skeleton-line w-70" />
            <div className="ai-skeleton-line w-95" />
            <div className="ai-skeleton-line w-90" />
          </div>
          <div className="ai-skeleton-block">
            <div className="ai-skeleton-line w-65" />
            <div className="ai-skeleton-line w-88" />
            <div className="ai-skeleton-line w-92" />
            <div className="ai-skeleton-line w-55" />
          </div>
        </div>
      )}
      {activeIssue && error && <div className="meta">AI error: {error}</div>}

      {activeIssue && explain && (
        <div className="ai-block">
          <div className="ai-block-head">
            <span className="ai-block-title">Explain</span>
            <div className="ai-block-badges">
              <span className="ai-source-pill">{explain.source}</span>
              {renderAiUsageBadge(explain.usage, explain.provider)}
            </div>
          </div>
          <div className="ai-rich-text">{renderAiRichText(explain.explanation, "explain")}</div>
          {explain.recommendations.length > 0 && (
            <ul>
              {explain.recommendations.map((recommendation) => (
                <li key={recommendation}>{renderAiInlineText(recommendation, `recommendation-${recommendation}`)}</li>
              ))}
            </ul>
          )}
          {showDebugPayloads && explain.debug && <AiDebugPanel debug={explain.debug} />}
        </div>
      )}

      {activeIssue && suggestFix && (
        <div className="ai-block">
          <div className="ai-block-head">
            <span className="ai-block-title">Suggest fix</span>
            <div className="ai-block-badges">
              <span className="ai-source-pill">{suggestFix.source}</span>
              {renderAiUsageBadge(suggestFix.usage, suggestFix.provider)}
            </div>
          </div>
          <div className="ai-rich-text">{renderAiRichText(suggestFix.rationale, "rationale")}</div>
          {suggestFix.proposedDiff ? (
            <pre className="diff-block">{renderDiffWithHighlight(normalizeProposedDiff(suggestFix.proposedDiff), "suggested-diff")}</pre>
          ) : (
            <div className="meta ai-rejected-reason">
              <span>No safe patch available.</span>{" "}
              {suggestFix.rejectedReason
                ? renderAiInlineText(suggestFix.rejectedReason, "rejected-reason")
                : "Patch was rejected by guardrails."}
            </div>
          )}
          {showDebugPayloads && suggestFix.debug && <AiDebugPanel debug={suggestFix.debug} />}
        </div>
      )}
    </section>
  );
}

function AiDebugPanel({
  debug
}: {
  debug: AiLlmDebugPayload;
}) {
  return (
    <details className="ai-debug-panel" open>
      <summary>Raw LLM payload</summary>
      <div className="ai-debug-grid">
        <div>
          <div className="ai-debug-label">Strategy</div>
          <pre className="ai-debug-block">{debug.strategy}</pre>
        </div>
        <div>
          <div className="ai-debug-label">Endpoint</div>
          <pre className="ai-debug-block">{debug.endpoint}</pre>
        </div>
        <div>
          <div className="ai-debug-label">Prompt</div>
          <pre className="ai-debug-block">{debug.prompt}</pre>
        </div>
        <div>
          <div className="ai-debug-label">Request body</div>
          <pre className="ai-debug-block">{toJsonDebug(debug.requestBody)}</pre>
        </div>
        <div>
          <div className="ai-debug-label">Raw response</div>
          <pre className="ai-debug-block">{toJsonDebug(debug.rawResponse)}</pre>
        </div>
      </div>
    </details>
  );
}

function renderAiRichText(content: string, keyPrefix: string): ReactNode[] {
  const blocks = parseAiMarkdownBlocks(content);

  return blocks.map((block, index) => {
    const blockKey = `${keyPrefix}-block-${index}`;
    if (block.type === "code") {
      return (
        <div key={blockKey} className="ai-code-wrap">
          {block.language && <div className="ai-code-language">{block.language}</div>}
          <pre className="ai-code-block">{block.content}</pre>
        </div>
      );
    }

    return <div key={blockKey}>{renderAiTextParagraphs(block.content, blockKey)}</div>;
  });
}

function renderAiTextParagraphs(content: string, keyPrefix: string): ReactNode[] {
  const paragraphs = content
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.length > 0);

  return paragraphs.map((paragraph, paragraphIndex) => {
    const lines = paragraph.split("\n");
    return (
      <p key={`${keyPrefix}-paragraph-${paragraphIndex}`} className="ai-paragraph">
        {lines.map((line, lineIndex) => (
          <span key={`${keyPrefix}-paragraph-${paragraphIndex}-line-${lineIndex}`}>
            {renderAiInlineText(line, `${keyPrefix}-paragraph-${paragraphIndex}-line-${lineIndex}`)}
            {lineIndex < lines.length - 1 && <br />}
          </span>
        ))}
      </p>
    );
  });
}

function renderAiInlineText(content: string, keyPrefix: string): ReactNode[] {
  const segments = content.split(/(`[^`]+`)/g).filter((segment) => segment.length > 0);

  return segments.flatMap((segment, segmentIndex) => {
    const segmentKey = `${keyPrefix}-segment-${segmentIndex}`;
    if (segment.startsWith("`") && segment.endsWith("`")) {
      return [
        <code key={segmentKey} className="ai-inline-code">
          {segment.slice(1, -1)}
        </code>
      ];
    }

    const strongSegments = segment.split(/(\*\*[^*]+\*\*)/g).filter((item) => item.length > 0);
    return strongSegments.map((strongSegment, strongIndex) => {
      const strongKey = `${segmentKey}-strong-${strongIndex}`;
      if (strongSegment.startsWith("**") && strongSegment.endsWith("**")) {
        return <strong key={strongKey}>{strongSegment.slice(2, -2)}</strong>;
      }

      return <span key={strongKey}>{strongSegment}</span>;
    });
  });
}

function parseAiMarkdownBlocks(content: string): Array<{ type: "text"; content: string } | { type: "code"; language: string; content: string }> {
  const blocks: Array<{ type: "text"; content: string } | { type: "code"; language: string; content: string }> = [];
  const chunks = content.split("```");

  for (let index = 0; index < chunks.length; index += 1) {
    const chunk = chunks[index] ?? "";
    const isCodeChunk = index % 2 === 1;

    if (!isCodeChunk) {
      if (chunk.length > 0) {
        blocks.push({
          type: "text",
          content: chunk
        });
      }

      continue;
    }

    const trimmedChunk = chunk.trim();
    if (trimmedChunk.length === 0) {
      continue;
    }

    const multiLineMatch = /^(?<language>[a-zA-Z0-9_-]+)?\s*\n(?<code>[\s\S]*)$/u.exec(trimmedChunk);
    if (multiLineMatch?.groups) {
      blocks.push({
        type: "code",
        language: (multiLineMatch.groups.language ?? "").trim(),
        content: (multiLineMatch.groups.code ?? "").trimEnd()
      });
      continue;
    }

    const inlineMatch = /^(?<language>[a-zA-Z0-9_-]+)\s+(?<code>[\s\S]*)$/u.exec(trimmedChunk);
    if (inlineMatch?.groups) {
      blocks.push({
        type: "code",
        language: inlineMatch.groups.language.trim(),
        content: (inlineMatch.groups.code ?? "").trim()
      });
      continue;
    }

    blocks.push({
      type: "code",
      language: "",
      content: trimmedChunk
    });
  }

  if (blocks.length === 0) {
    blocks.push({
      type: "text",
      content
    });
  }

  return blocks;
}

function normalizeProposedDiff(content: string): string {
  const trimmed = content.trim();
  const fencedDiffMatch = /^```(?:diff)?\s*\n([\s\S]*?)\n```$/u.exec(trimmed);
  if (fencedDiffMatch?.[1]) {
    return fencedDiffMatch[1].trimEnd();
  }

  return trimmed;
}

function renderDiffWithHighlight(content: string, keyPrefix: string): ReactNode[] {
  const lines = content.split("\n");

  return lines.map((line, index) => {
    const className = getDiffLineClass(line);
    const key = `${keyPrefix}-${index}`;
    return (
      <span key={key} className={`diff-line ${className}`}>
        {line}
        {index < lines.length - 1 && "\n"}
      </span>
    );
  });
}

function getDiffLineClass(line: string): string {
  if (line.startsWith("+++ ") || line.startsWith("--- ") || line.startsWith("@@")) {
    return "diff-line-meta";
  }

  if (line.startsWith("+") && !line.startsWith("+++ ")) {
    return "diff-line-add";
  }

  if (line.startsWith("-") && !line.startsWith("--- ")) {
    return "diff-line-remove";
  }

  return "diff-line-context";
}

function renderAiUsageBadge(usage: AiUsage | null, provider: string): ReactNode | null {
  if (provider === "ollama") {
    return <span className="ai-cost-pill">local</span>;
  }

  if (!usage) {
    return null;
  }

  if (usage.totalTokens === null) {
    return <span className="ai-cost-pill">tokens n/a</span>;
  }

  return <span className="ai-cost-pill">{usage.totalTokens} tok</span>;
}

function toJsonDebug(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}
