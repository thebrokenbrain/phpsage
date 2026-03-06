// This component renders source code, syntax highlighting, and in-file issue navigation.
import { useEffect, useMemo, useRef } from "react";
import type { RunIssue } from "../types.js";

export interface FileIssueViewItem {
  readonly issue: RunIssue;
  readonly issueIndex: number;
}

interface CodeWindowProps {
  issue: RunIssue | null;
  activeIssueIndex: number | null;
  fileIssues: FileIssueViewItem[];
  sourceContent: string | null;
  onSelectIssue: (issueIndex: number) => void;
}

export function CodeWindow({
  issue,
  activeIssueIndex,
  fileIssues,
  sourceContent,
  onSelectIssue
}: CodeWindowProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const highlightedRowRef = useRef<HTMLDivElement | null>(null);
  const lines = sourceContent ? sourceContent.split(/\r?\n/) : [];
  const highlightLine = issue?.line ?? null;
  const issuesByLine = useMemo(() => {
    const groups = new Map<number, FileIssueViewItem[]>();
    for (const fileIssue of fileIssues) {
      const current = groups.get(fileIssue.issue.line) ?? [];
      current.push(fileIssue);
      groups.set(fileIssue.issue.line, current);
    }

    return groups;
  }, [fileIssues]);

  const start = 1;
  const end = Math.max(lines.length, 1);
  const rows = [];

  useEffect(() => {
    if (highlightLine && highlightedRowRef.current) {
      highlightedRowRef.current.scrollIntoView({ block: "center", inline: "nearest" });
      return;
    }

    if (containerRef.current) {
      containerRef.current.scrollTop = 0;
    }
  }, [highlightLine, sourceContent]);

  for (let line = start; line <= end; line += 1) {
    rows.push({
      line,
      content: lines[line - 1] ?? ""
    });
  }

  return (
    <>
      {fileIssues.length > 0 && (
        <div className="file-issues-list">
          {fileIssues.map((fileIssue) => (
            <button
              key={`${fileIssue.issue.file}-${fileIssue.issue.line}-${fileIssue.issue.message}`}
              className={`file-issue-chip ${activeIssueIndex === fileIssue.issueIndex ? "active" : ""}`}
              onClick={() => onSelectIssue(fileIssue.issueIndex)}
              title={fileIssue.issue.message}
            >
              <span className="file-issue-chip-line">L{fileIssue.issue.line}</span>
              <span className="file-issue-chip-message">{fileIssue.issue.message}</span>
            </button>
          ))}
        </div>
      )}

      <div className="code-body" ref={containerRef}>
        {rows.map((row) => {
          const lineIssues = issuesByLine.get(row.line) ?? [];
          const lineIssueCount = lineIssues.length;
          const hasLineIssue = lineIssueCount > 0;

          const handleSelectLineIssue = () => {
            const nextIssueIndex = getNextLineIssueIndex(lineIssues, activeIssueIndex);
            if (nextIssueIndex !== null) {
              onSelectIssue(nextIssueIndex);
            }
          };

          return (
            <div
              key={row.line}
              className={`code-row ${highlightLine === row.line ? "active" : ""} ${lineIssueCount > 0 ? "has-issue" : ""}`}
              ref={highlightLine === row.line ? highlightedRowRef : undefined}
              onClick={hasLineIssue ? handleSelectLineIssue : undefined}
              onKeyDown={
                hasLineIssue
                  ? (event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        handleSelectLineIssue();
                      }
                    }
                  : undefined
              }
              role={hasLineIssue ? "button" : undefined}
              tabIndex={hasLineIssue ? 0 : -1}
              aria-label={hasLineIssue ? `Select issue on line ${row.line}` : undefined}
            >
              <div className="line-number">
                <span>{row.line}</span>
                {lineIssueCount > 0 && <span className="line-error-dot">{lineIssueCount}</span>}
              </div>
              <div className="line-content">
                <div className="line-code">{renderPhpLine(row.content)}</div>
                {highlightLine === row.line && issue && (
                  <div className="line-issue-hint" title={issue.message}>
                    <span className="line-issue-pill">⚠ Issue</span>
                    <span className="line-issue-text">{issue.message}</span>
                    {issue.identifier && <span className="line-issue-identifier">#{issue.identifier}</span>}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

function getNextLineIssueIndex(lineIssues: FileIssueViewItem[], activeIssueIndex: number | null): number | null {
  if (lineIssues.length === 0) {
    return null;
  }

  if (activeIssueIndex === null) {
    return lineIssues[0].issueIndex;
  }

  const activeIndexWithinLine = lineIssues.findIndex((lineIssue) => lineIssue.issueIndex === activeIssueIndex);
  if (activeIndexWithinLine < 0) {
    return lineIssues[0].issueIndex;
  }

  const nextIndex = (activeIndexWithinLine + 1) % lineIssues.length;
  return lineIssues[nextIndex].issueIndex;
}

function renderPhpLine(content: string): JSX.Element[] {
  const tokens: JSX.Element[] = [];
  const expression = /(\/\*.*?\*\/|\/\/.*|#.*|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|\$[A-Za-z_]\w*|\b(?:if|else|elseif|return|function|class|public|private|protected|try|catch|throw|new|extends|implements|static|foreach|for|while|switch|case|break|continue|namespace|use|null|true|false)\b|\b\d+(?:\.\d+)?\b|->|::)/g;

  let lastIndex = 0;
  let match = expression.exec(content);
  while (match) {
    const start = match.index;
    const end = expression.lastIndex;
    const value = match[0];

    if (start > lastIndex) {
      tokens.push(<span key={`plain-${lastIndex}`}>{content.slice(lastIndex, start)}</span>);
    }

    tokens.push(
      <span key={`token-${start}`} className={`php-token ${getPhpTokenClass(value)}`}>
        {value}
      </span>
    );

    lastIndex = end;
    match = expression.exec(content);
  }

  if (lastIndex < content.length) {
    tokens.push(<span key={`plain-tail-${lastIndex}`}>{content.slice(lastIndex)}</span>);
  }

  return tokens;
}

function getPhpTokenClass(value: string): string {
  if (value.startsWith("$")) {
    return "php-variable";
  }

  if (value.startsWith("//") || value.startsWith("#") || value.startsWith("/*")) {
    return "php-comment";
  }

  if (value.startsWith("\"") || value.startsWith("'")) {
    return "php-string";
  }

  if (/^\d/.test(value)) {
    return "php-number";
  }

  if (value === "->" || value === "::") {
    return "php-operator";
  }

  return "php-keyword";
}
