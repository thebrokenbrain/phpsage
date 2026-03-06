import type { RunIssue, RunRecord } from "../types.js";

interface IssuesDetailBlockProps {
  isIssuesSectionOpen: boolean;
  setIsIssuesSectionOpen: (value: boolean | ((current: boolean) => boolean)) => void;
  issueSearchTerm: string;
  setIssueSearchTerm: (value: string) => void;
  issueIdentifierFilter: "all" | "with" | "without";
  setIssueIdentifierFilter: (value: "all" | "with" | "without") => void;
  setIssuePage: (value: number | ((current: number) => number)) => void;
  filteredIssueEntries: Array<{ issue: RunIssue; absoluteIndex: number }>;
  issuePage: number;
  detailPageSize: number;
  selectedIssueIndex: number;
  setSelectedIssueIndex: (value: number | ((current: number) => number)) => void;
  setSelectedSourceFilePath: (value: string | null) => void;
  selectedRun: RunRecord;
}

export function IssuesDetailBlock({
  isIssuesSectionOpen,
  setIsIssuesSectionOpen,
  issueSearchTerm,
  setIssueSearchTerm,
  issueIdentifierFilter,
  setIssueIdentifierFilter,
  setIssuePage,
  filteredIssueEntries,
  issuePage,
  detailPageSize,
  selectedIssueIndex,
  setSelectedIssueIndex,
  setSelectedSourceFilePath,
  selectedRun
}: IssuesDetailBlockProps): JSX.Element {
  return (
    <section className="detail-block">
      <div className="detail-block-header">
        <h3>Issues</h3>
        <button
          onClick={() => {
            setIsIssuesSectionOpen((isOpen) => !isOpen);
          }}
        >
          {isIssuesSectionOpen ? "Hide" : "Show"}
        </button>
        <div className="detail-actions">
          <button
            onClick={() => {
              setIssueSearchTerm("");
              setIssueIdentifierFilter("all");
              setIssuePage(0);
            }}
            disabled={issueSearchTerm.trim().length === 0 && issueIdentifierFilter === "all"}
          >
            Clear issue filters
          </button>
          <select
            value={issueIdentifierFilter}
            onChange={(event) => {
              const value = event.target.value;
              if (value === "with" || value === "without") {
                setIssueIdentifierFilter(value);
                setIssuePage(0);
                return;
              }

              setIssueIdentifierFilter("all");
              setIssuePage(0);
            }}
          >
            <option value="all">All identifiers</option>
            <option value="with">With identifier</option>
            <option value="without">Without identifier</option>
          </select>
          <input
            type="search"
            placeholder="Filter issues"
            value={issueSearchTerm}
            onChange={(event) => {
              setIssueSearchTerm(event.target.value);
              setIssuePage(0);
            }}
          />
        </div>
        {isIssuesSectionOpen && filteredIssueEntries.length > detailPageSize ? (
          <div className="pager">
            <button
              onClick={() => {
                setIssuePage((page) => Math.max(0, page - 1));
              }}
              disabled={issuePage === 0}
            >
              Prev
            </button>
            <span>
              {issuePage + 1}/{Math.max(1, Math.ceil(filteredIssueEntries.length / detailPageSize))}
            </span>
            <button
              onClick={() => {
                setIssuePage((page) => {
                  const maxPage = Math.max(0, Math.ceil(filteredIssueEntries.length / detailPageSize) - 1);
                  return Math.min(maxPage, page + 1);
                });
              }}
              disabled={issuePage >= Math.max(0, Math.ceil(filteredIssueEntries.length / detailPageSize) - 1)}
            >
              Next
            </button>
          </div>
        ) : null}
      </div>

      {isIssuesSectionOpen ? (
        filteredIssueEntries.length > 0 ? (
          <ul className="detail-list">
            {filteredIssueEntries
              .slice(issuePage * detailPageSize, (issuePage + 1) * detailPageSize)
              .map(({ issue, absoluteIndex }) => {
                return (
                  <li
                    key={`${issue.file}-${issue.line}-${absoluteIndex}`}
                    className={absoluteIndex === selectedIssueIndex ? "selected-issue" : ""}
                    onClick={() => {
                      setSelectedIssueIndex(absoluteIndex);
                      setSelectedSourceFilePath(null);
                    }}
                  >
                    <span className="mono">{issue.file}:{issue.line}</span> — {issue.message}
                    {issue.identifier ? <span className="issue-identifier">[{issue.identifier}]</span> : null}
                  </li>
                );
              })}
          </ul>
        ) : selectedRun.issues.length > 0 ? (
          <p className="empty">No issues match current filter.</p>
        ) : (
          <p className="empty">No issues in selected run.</p>
        )
      ) : null}
    </section>
  );
}