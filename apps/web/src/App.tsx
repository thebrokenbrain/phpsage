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

interface RunFileItem {
  path: string;
  issueCount: number;
  hasIssues: boolean;
}

interface RunFilesPayload {
  targetPath: string;
  files: RunFileItem[];
}

interface SourcePayload {
  file: string;
  content: string;
}

const defaultApiBaseUrl = "http://localhost:8080";
const detailPageSize = 10;

function readInitialQuerySelection(): { runId: string | null; file: string | null } {
  if (typeof window === "undefined") {
    return { runId: null, file: null };
  }

  const searchParams = new URLSearchParams(window.location.search);
  const runId = searchParams.get("runId");
  const file = searchParams.get("file");

  return {
    runId: runId && runId.trim().length > 0 ? runId : null,
    file: file && file.trim().length > 0 ? file : null
  };
}

export function App(): JSX.Element {
  const initialSelection = useMemo(() => readInitialQuerySelection(), []);
  const apiBaseUrl = useMemo(() => {
    const value = import.meta.env.VITE_API_BASE_URL as string | undefined;
    return value && value.trim().length > 0 ? value : defaultApiBaseUrl;
  }, []);

  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(initialSelection.runId);
  const [selectedRun, setSelectedRun] = useState<RunRecord | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [issuePage, setIssuePage] = useState(0);
  const [logPage, setLogPage] = useState(0);
  const [selectedIssueIndex, setSelectedIssueIndex] = useState(0);
  const [runFiles, setRunFiles] = useState<RunFileItem[]>([]);
  const [filesLoading, setFilesLoading] = useState(false);
  const [filesError, setFilesError] = useState<string | null>(null);
  const [selectedSourceFilePath, setSelectedSourceFilePath] = useState<string | null>(initialSelection.file);
  const [sourceLoading, setSourceLoading] = useState(false);
  const [sourceError, setSourceError] = useState<string | null>(null);
  const [sourcePayload, setSourcePayload] = useState<SourcePayload | null>(null);

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
    if (typeof window === "undefined") {
      return;
    }

    const url = new URL(window.location.href);

    if (selectedRunId) {
      url.searchParams.set("runId", selectedRunId);
    } else {
      url.searchParams.delete("runId");
    }

    if (selectedSourceFilePath) {
      url.searchParams.set("file", selectedSourceFilePath);
    } else {
      url.searchParams.delete("file");
    }

    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
  }, [selectedRunId, selectedSourceFilePath]);

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
        setSelectedIssueIndex(0);
        setSelectedSourceFilePath((currentPath) => {
          if (!currentPath) {
            return null;
          }

          return currentPath.startsWith(`${payload.targetPath}/`) ? currentPath : null;
        });
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

  useEffect(() => {
    async function loadRunFiles(runId: string): Promise<void> {
      setFilesLoading(true);
      setFilesError(null);

      try {
        const response = await fetch(`${apiBaseUrl}/api/runs/${runId}/files`);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const payload = (await response.json()) as RunFilesPayload;
        setRunFiles(payload.files);
      } catch (fetchError) {
        const message = fetchError instanceof Error ? fetchError.message : String(fetchError);
        setFilesError(message);
        setRunFiles([]);
      } finally {
        setFilesLoading(false);
      }
    }

    if (!selectedRunId) {
      setRunFiles([]);
      setFilesError(null);
      setFilesLoading(false);
      return;
    }

    void loadRunFiles(selectedRunId);
  }, [apiBaseUrl, selectedRunId]);

  useEffect(() => {
    async function loadSource(runId: string, filePath: string): Promise<void> {
      setSourceLoading(true);
      setSourceError(null);

      try {
        const endpoint = `${apiBaseUrl}/api/runs/${runId}/source?file=${encodeURIComponent(filePath)}`;
        const response = await fetch(endpoint);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const payload = (await response.json()) as SourcePayload;
        setSourcePayload(payload);
      } catch (fetchError) {
        const message = fetchError instanceof Error ? fetchError.message : String(fetchError);
        setSourceError(message);
        setSourcePayload(null);
      } finally {
        setSourceLoading(false);
      }
    }

    if (!selectedRunId || !selectedRun) {
      setSourceLoading(false);
      setSourceError(null);
      setSourcePayload(null);
      return;
    }

    if (selectedSourceFilePath) {
      void loadSource(selectedRunId, selectedSourceFilePath);
      return;
    }

    if (selectedRun.issues.length === 0) {
      setSourceLoading(false);
      setSourceError(null);
      setSourcePayload(null);
      return;
    }

    const safeIssueIndex = Math.min(selectedIssueIndex, selectedRun.issues.length - 1);
    const issue = selectedRun.issues[safeIssueIndex];
    if (!issue || !issue.file) {
      setSourceLoading(false);
      setSourceError(null);
      setSourcePayload(null);
      return;
    }

    void loadSource(selectedRunId, issue.file);
  }, [apiBaseUrl, selectedIssueIndex, selectedRun, selectedRunId, selectedSourceFilePath]);

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
                  <h3>Files</h3>
                </div>

                {filesLoading ? <p className="empty">Loading files...</p> : null}
                {filesError ? <p className="error">Could not load files: {filesError}</p> : null}

                {!filesLoading && !filesError && runFiles.length > 0 ? (
                  <ul className="detail-list">
                    {runFiles.slice(0, 30).map((fileEntry) => (
                      <li
                        key={fileEntry.path}
                        className={selectedSourceFilePath === `${selectedRun.targetPath}/${fileEntry.path}` ? "selected-issue" : ""}
                        onClick={() => {
                          setSelectedSourceFilePath(`${selectedRun.targetPath}/${fileEntry.path}`);
                        }}
                      >
                        <span className="mono">{fileEntry.path}</span>
                        {" — "}
                        issues: {fileEntry.issueCount}
                      </li>
                    ))}
                  </ul>
                ) : null}

                {!filesLoading && !filesError && runFiles.length === 0 ? (
                  <p className="empty">No PHP files for selected run.</p>
                ) : null}
              </section>

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
                      .map((issue, index) => {
                        const absoluteIndex = issuePage * detailPageSize + index;
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
                        </li>
                        );
                      })}
                  </ul>
                ) : (
                  <p className="empty">No issues in selected run.</p>
                )}
              </section>

              <section className="detail-block">
                <div className="detail-block-header">
                  <h3>Source Preview</h3>
                </div>

                {sourceLoading ? <p className="empty">Loading source preview...</p> : null}
                {sourceError ? <p className="error">Could not load source: {sourceError}</p> : null}

                {!sourceLoading && !sourceError && sourcePayload ? (
                  <>
                    <p className="mono">{sourcePayload.file}</p>
                    <pre className="source-preview">{sourcePayload.content}</pre>
                  </>
                ) : null}

                {!sourceLoading && !sourceError && !sourcePayload ? (
                  <p className="empty">Select an issue to load source preview.</p>
                ) : null}
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
