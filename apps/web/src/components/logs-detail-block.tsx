import type { RunLogEntry, RunRecord } from "../types.js";

interface LogsDetailBlockProps {
  isLogsSectionOpen: boolean;
  setIsLogsSectionOpen: (value: boolean | ((current: boolean) => boolean)) => void;
  logSearchTerm: string;
  setLogSearchTerm: (value: string) => void;
  logStreamFilter: "all" | "stdout" | "stderr";
  setLogStreamFilter: (value: "all" | "stdout" | "stderr") => void;
  setLogPage: (value: number | ((current: number) => number)) => void;
  filteredLogs: RunLogEntry[];
  logPage: number;
  detailPageSize: number;
  selectedRun: RunRecord;
}

export function LogsDetailBlock({
  isLogsSectionOpen,
  setIsLogsSectionOpen,
  logSearchTerm,
  setLogSearchTerm,
  logStreamFilter,
  setLogStreamFilter,
  setLogPage,
  filteredLogs,
  logPage,
  detailPageSize,
  selectedRun
}: LogsDetailBlockProps): JSX.Element {
  return (
    <section className="detail-block">
      <div className="detail-block-header">
        <h3>Logs</h3>
        <button
          onClick={() => {
            setIsLogsSectionOpen((isOpen) => !isOpen);
          }}
        >
          {isLogsSectionOpen ? "Hide" : "Show"}
        </button>
        <div className="detail-actions">
          <button
            onClick={() => {
              setLogSearchTerm("");
              setLogStreamFilter("all");
              setLogPage(0);
            }}
            disabled={logSearchTerm.trim().length === 0 && logStreamFilter === "all"}
          >
            Clear log filters
          </button>
          <select
            value={logStreamFilter}
            onChange={(event) => {
              const value = event.target.value;
              if (value === "stdout" || value === "stderr") {
                setLogStreamFilter(value);
                setLogPage(0);
                return;
              }

              setLogStreamFilter("all");
              setLogPage(0);
            }}
          >
            <option value="all">All streams</option>
            <option value="stdout">stdout</option>
            <option value="stderr">stderr</option>
          </select>
          <input
            type="search"
            placeholder="Filter logs"
            value={logSearchTerm}
            onChange={(event) => {
              setLogSearchTerm(event.target.value);
              setLogPage(0);
            }}
          />
        </div>
        {isLogsSectionOpen && filteredLogs.length > detailPageSize ? (
          <div className="pager">
            <button
              onClick={() => {
                setLogPage((page) => Math.max(0, page - 1));
              }}
              disabled={logPage === 0}
            >
              Prev
            </button>
            <span>
              {logPage + 1}/{Math.max(1, Math.ceil(filteredLogs.length / detailPageSize))}
            </span>
            <button
              onClick={() => {
                setLogPage((page) => {
                  const maxPage = Math.max(0, Math.ceil(filteredLogs.length / detailPageSize) - 1);
                  return Math.min(maxPage, page + 1);
                });
              }}
              disabled={logPage >= Math.max(0, Math.ceil(filteredLogs.length / detailPageSize) - 1)}
            >
              Next
            </button>
          </div>
        ) : null}
      </div>

      {isLogsSectionOpen ? (
        filteredLogs.length > 0 ? (
          <ul className="detail-list">
            {filteredLogs
              .slice(logPage * detailPageSize, (logPage + 1) * detailPageSize)
              .map((logEntry, index) => (
                <li key={`${logEntry.timestamp}-${logEntry.stream}-${index}`}>
                  <span className="mono">{new Date(logEntry.timestamp).toLocaleTimeString()} [{logEntry.stream}]</span>
                  {" — "}
                  {logEntry.message.length > 200 ? `${logEntry.message.slice(0, 200)}…` : logEntry.message}
                </li>
              ))}
          </ul>
        ) : selectedRun.logs.length > 0 ? (
          <p className="empty">No logs match current filter.</p>
        ) : (
          <p className="empty">No logs in selected run.</p>
        )
      ) : null}
    </section>
  );
}