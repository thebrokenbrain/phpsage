import type { SourcePayload } from "../types.js";

interface SourceDetailBlockProps {
  isSourceSectionOpen: boolean;
  setIsSourceSectionOpen: (value: boolean | ((current: boolean) => boolean)) => void;
  sourceLoading: boolean;
  sourceError: string | null;
  sourcePayload: SourcePayload | null;
  activeIssueLineInSource: number | null;
}

export function SourceDetailBlock({
  isSourceSectionOpen,
  setIsSourceSectionOpen,
  sourceLoading,
  sourceError,
  sourcePayload,
  activeIssueLineInSource
}: SourceDetailBlockProps): JSX.Element {
  return (
    <section className="detail-block">
      <div className="detail-block-header">
        <h3>Source Preview</h3>
        <button
          onClick={() => {
            setIsSourceSectionOpen((isOpen) => !isOpen);
          }}
        >
          {isSourceSectionOpen ? "Hide" : "Show"}
        </button>
      </div>

      {isSourceSectionOpen ? (
        <>
          {sourceLoading ? <p className="empty">Loading source preview...</p> : null}
          {sourceError ? <p className="error">Could not load source: {sourceError}</p> : null}

          {!sourceLoading && !sourceError && sourcePayload ? (
            <>
              <p className="mono">{sourcePayload.file}</p>
              <pre className="source-preview">
                {sourcePayload.content.split("\n").map((lineContent, index) => {
                  const lineNumber = index + 1;
                  const isActiveLine = activeIssueLineInSource === lineNumber;

                  return (
                    <div key={`${lineNumber}-${lineContent}`} className={isActiveLine ? "source-line active" : "source-line"}>
                      <span className="source-line-number">{lineNumber}</span>
                      <span>{lineContent}</span>
                    </div>
                  );
                })}
              </pre>
            </>
          ) : null}

          {!sourceLoading && !sourceError && !sourcePayload ? (
            <p className="empty">Select an issue to load source preview.</p>
          ) : null}
        </>
      ) : null}
    </section>
  );
}