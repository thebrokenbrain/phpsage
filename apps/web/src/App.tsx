import { useEffect, useMemo, useState } from "react";

interface RunSummary {
  runId: string;
  targetPath: string;
  status: "running" | "finished";
  createdAt: string;
  updatedAt: string;
  exitCode: number | null;
  issueCount: number;
}

interface RunIssue {
  file: string;
  line: number;
  message: string;
  identifier?: string;
}

interface RunLogEntry {
  timestamp: string;
  stream: "stdout" | "stderr";
  message: string;
}

interface RunRecord extends RunSummary {
  logs: RunLogEntry[];
  issues: RunIssue[];
}

const defaultApiBaseUrl = "http://localhost:8080";
const detailPageSize = 10;

export function App(): JSX.Element {
  const apiBaseUrl = useMemo(() => {
    const value = import.meta.env.VITE_API_BASE_URL as string | undefined;
    return value && value.trim().length > 0 ? value : defaultApiBaseUrl;
  }, []);

  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [selectedRun, setSelectedRun] = useState<RunRecord | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [issuePage, setIssuePage] = useState(0);
  const [logPage, setLogPage] = useState(0);

  async function loadRuns(): Promise<void> {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${apiBaseUrl}/api/runs`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const payload = (await response.json()) as RunSummary[];
      setRuns(payload);

      if (payload.length === 0) {
        setSelectedRunId(null);
        setSelectedRun(null);
        return;
      }

      setSelectedRunId((currentSelectedRunId) => {
        if (!currentSelectedRunId) {
          return payload[0].runId;
        }

        const stillExists = payload.some((run) => run.runId === currentSelectedRunId);
        return stillExists ? currentSelectedRunId : payload[0].runId;
      });
    } catch (fetchError) {
      const message = fetchError instanceof Error ? fetchError.message : String(fetchError);
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadRuns();
  }, []);

  useEffect(() => {
    async function loadRunDetail(runId: string): Promise<void> {
      setDetailLoading(true);
      setDetailError(null);

      try {
        const response = await fetch(`${apiBaseUrl}/api/runs/${runId}`);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const payload = (await response.json()) as RunRecord;
        setSelectedRun(payload);
        setIssuePage(0);
        setLogPage(0);
      } catch (fetchError) {
        const message = fetchError instanceof Error ? fetchError.message : String(fetchError);
        setDetailError(message);
        setSelectedRun(null);
      } finally {
        setDetailLoading(false);
      }
    }

    if (!selectedRunId) {
      setSelectedRun(null);
      setDetailLoading(false);
      setDetailError(null);
      return;
    }

    void loadRunDetail(selectedRunId);
  }, [apiBaseUrl, selectedRunId]);

  return (
    <main className="app">
      <header className="header">
        <h1>PHPSage Dashboard</h1>
        <button onClick={() => void loadRuns()} disabled={loading}>
          {loading ? "Loading..." : "Refresh"}
        </button>
      </header>

      {error ? <p className="error">Could not load runs: {error}</p> : null}

      {!loading && runs.length === 0 ? <p className="empty">No runs yet.</p> : null}

      {runs.length > 0 ? (
        <table className="runs-table">
          <thead>
            <tr>
              <th>Run</th>
              <th>Status</th>
              <th>Exit</th>
              <th>Issues</th>
              <th>Target</th>
              <th>Updated</th>
            </tr>
          </thead>
          <tbody>
            {runs.map((run) => (
              <tr
                key={run.runId}
                className={run.runId === selectedRunId ? "selected" : ""}
                onClick={() => {
                  setSelectedRunId(run.runId);
                }}
              >
                <td className="mono">{run.runId.slice(0, 8)}</td>
                <td>{run.status}</td>
                <td>{run.exitCode ?? "-"}</td>
                <td>{run.issueCount}</td>
                <td className="mono">{run.targetPath}</td>
                <td>{new Date(run.updatedAt).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}

      {selectedRunId ? (
        <section className="detail-panel">
          <h2>Run detail</h2>
          {detailLoading ? <p className="empty">Loading selected run...</p> : null}
          {detailError ? <p className="error">Could not load run detail: {detailError}</p> : null}

          {!detailLoading && !detailError && selectedRun ? (
            <>
              <p className="mono">{selectedRun.runId}</p>
              <p>Status: {selectedRun.status} · Exit: {selectedRun.exitCode ?? "-"}</p>
              <p className="mono">Target: {selectedRun.targetPath}</p>
              <p>Logs: {selectedRun.logs.length} · Issues: {selectedRun.issues.length}</p>

              <section className="detail-block">
                <div className="detail-block-header">
                  <h3>Issues</h3>
                  {selectedRun.issues.length > detailPageSize ? (
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
                        {issuePage + 1}/{Math.max(1, Math.ceil(selectedRun.issues.length / detailPageSize))}
                      </span>
                      <button
                        onClick={() => {
                          setIssuePage((page) => {
                            const maxPage = Math.max(0, Math.ceil(selectedRun.issues.length / detailPageSize) - 1);
                            return Math.min(maxPage, page + 1);
                          });
                        }}
                        disabled={issuePage >= Math.max(0, Math.ceil(selectedRun.issues.length / detailPageSize) - 1)}
                      >
                        Next
                      </button>
                    </div>
                  ) : null}
                </div>

                {selectedRun.issues.length > 0 ? (
                  <ul className="detail-list">
                    {selectedRun.issues
                      .slice(issuePage * detailPageSize, (issuePage + 1) * detailPageSize)
                      .map((issue, index) => (
                        <li key={`${issue.file}-${issue.line}-${index}`}>
                          <span className="mono">{issue.file}:{issue.line}</span> — {issue.message}
                        </li>
                      ))}
                  </ul>
                ) : (
                  <p className="empty">No issues in selected run.</p>
                )}
              </section>

              <section className="detail-block">
                <div className="detail-block-header">
                  <h3>Logs</h3>
                  {selectedRun.logs.length > detailPageSize ? (
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
                        {logPage + 1}/{Math.max(1, Math.ceil(selectedRun.logs.length / detailPageSize))}
                      </span>
                      <button
                        onClick={() => {
                          setLogPage((page) => {
                            const maxPage = Math.max(0, Math.ceil(selectedRun.logs.length / detailPageSize) - 1);
                            return Math.min(maxPage, page + 1);
                          });
                        }}
                        disabled={logPage >= Math.max(0, Math.ceil(selectedRun.logs.length / detailPageSize) - 1)}
                      >
                        Next
                      </button>
                    </div>
                  ) : null}
                </div>

                {selectedRun.logs.length > 0 ? (
                  <ul className="detail-list">
                    {selectedRun.logs
                      .slice(logPage * detailPageSize, (logPage + 1) * detailPageSize)
                      .map((logEntry, index) => (
                        <li key={`${logEntry.timestamp}-${logEntry.stream}-${index}`}>
                          <span className="mono">{new Date(logEntry.timestamp).toLocaleTimeString()} [{logEntry.stream}]</span>
                          {" — "}
                          {logEntry.message.length > 200 ? `${logEntry.message.slice(0, 200)}…` : logEntry.message}
                        </li>
                      ))}
                  </ul>
                ) : (
                  <p className="empty">No logs in selected run.</p>
                )}
              </section>
            </>
          ) : null}
        </section>
      ) : null}
    </main>
  );
}
