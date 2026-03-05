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
const runningPollIntervalMs = 2000;

function readInitialQuerySelection(): {
  runId: string | null;
  file: string | null;
  issueIndex: number | null;
  logPage: number | null;
  runsStatusFilter: "all" | "running" | "finished";
  fileSearchTerm: string;
} {
  if (typeof window === "undefined") {
    return { runId: null, file: null, issueIndex: null, logPage: null, runsStatusFilter: "all", fileSearchTerm: "" };
  }

  const searchParams = new URLSearchParams(window.location.search);
  const runId = searchParams.get("runId");
  const file = searchParams.get("file");
  const issue = searchParams.get("issue");
  const logPage = searchParams.get("logPage");
  const status = searchParams.get("status");
  const fileQuery = searchParams.get("fileQuery");
  const parsedIssueIndex = issue ? Number.parseInt(issue, 10) : Number.NaN;
  const parsedLogPage = logPage ? Number.parseInt(logPage, 10) : Number.NaN;

  return {
    runId: runId && runId.trim().length > 0 ? runId : null,
    file: file && file.trim().length > 0 ? file : null,
    issueIndex: Number.isFinite(parsedIssueIndex) && parsedIssueIndex >= 0 ? parsedIssueIndex : null,
    logPage: Number.isFinite(parsedLogPage) && parsedLogPage >= 0 ? parsedLogPage : null,
    runsStatusFilter: status === "running" || status === "finished" ? status : "all",
    fileSearchTerm: fileQuery ?? ""
  };
}

export function App(): JSX.Element {
  const initialSelection = useMemo(() => readInitialQuerySelection(), []);
  const apiBaseUrl = useMemo(() => {
    const value = import.meta.env.VITE_API_BASE_URL as string | undefined;
    return value && value.trim().length > 0 ? value : defaultApiBaseUrl;
  }, []);

  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [runsStatusFilter, setRunsStatusFilter] = useState<"all" | "running" | "finished">(initialSelection.runsStatusFilter);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(initialSelection.runId);
  const [selectedRun, setSelectedRun] = useState<RunRecord | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [issuePage, setIssuePage] = useState(0);
  const [logPage, setLogPage] = useState(initialSelection.logPage ?? 0);
  const [selectedIssueIndex, setSelectedIssueIndex] = useState(initialSelection.issueIndex ?? 0);
  const [runFiles, setRunFiles] = useState<RunFileItem[]>([]);
  const [fileSearchTerm, setFileSearchTerm] = useState(initialSelection.fileSearchTerm);
  const [filesLoading, setFilesLoading] = useState(false);
  const [filesError, setFilesError] = useState<string | null>(null);
  const [selectedSourceFilePath, setSelectedSourceFilePath] = useState<string | null>(initialSelection.file);
  const [sourceLoading, setSourceLoading] = useState(false);
  const [sourceError, setSourceError] = useState<string | null>(null);
  const [sourcePayload, setSourcePayload] = useState<SourcePayload | null>(null);

  const filteredRuns = useMemo(() => {
    if (runsStatusFilter === "all") {
      return runs;
    }

    return runs.filter((run) => run.status === runsStatusFilter);
  }, [runs, runsStatusFilter]);

  const visibleRunFiles = useMemo(() => {
    const normalizedTerm = fileSearchTerm.trim().toLowerCase();
    if (normalizedTerm.length === 0) {
      return runFiles;
    }

    return runFiles.filter((fileEntry) => fileEntry.path.toLowerCase().includes(normalizedTerm));
  }, [fileSearchTerm, runFiles]);

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

      const fallbackRun =
        payload.find((run) => run.status === "running")
        ?? payload[0];

      if (payload.length === 0) {
        setSelectedRunId(null);
        setSelectedRun(null);
        return;
      }

      setSelectedRunId((currentSelectedRunId) => {
        if (!currentSelectedRunId) {
          return fallbackRun.runId;
        }

        const stillExists = payload.some((run) => run.runId === currentSelectedRunId);
        return stillExists ? currentSelectedRunId : fallbackRun.runId;
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

    function handlePopState(): void {
      const selection = readInitialQuerySelection();
      setSelectedRunId(selection.runId);
      setSelectedSourceFilePath(selection.file);
      setSelectedIssueIndex(selection.issueIndex ?? 0);
      setLogPage(selection.logPage ?? 0);
      setRunsStatusFilter(selection.runsStatusFilter);
      setFileSearchTerm(selection.fileSearchTerm);
    }

    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
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

    if (runsStatusFilter === "all") {
      url.searchParams.delete("status");
    } else {
      url.searchParams.set("status", runsStatusFilter);
    }

    if (fileSearchTerm.trim().length > 0) {
      url.searchParams.set("fileQuery", fileSearchTerm);
    } else {
      url.searchParams.delete("fileQuery");
    }

    if (selectedSourceFilePath) {
      url.searchParams.set("file", selectedSourceFilePath);
    } else {
      url.searchParams.delete("file");
    }

    if (selectedRun && selectedRun.issues.length > 0) {
      url.searchParams.set("issue", String(selectedIssueIndex));
    } else {
      url.searchParams.delete("issue");
    }

    if (selectedRun && selectedRun.logs.length > 0 && logPage > 0) {
      url.searchParams.set("logPage", String(logPage));
    } else {
      url.searchParams.delete("logPage");
    }

    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
  }, [fileSearchTerm, logPage, runsStatusFilter, selectedIssueIndex, selectedRun, selectedRunId, selectedSourceFilePath]);

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
    async function pollRunningRun(runId: string): Promise<void> {
      try {
        const [runsResponse, detailResponse, filesResponse] = await Promise.all([
          fetch(`${apiBaseUrl}/api/runs`),
          fetch(`${apiBaseUrl}/api/runs/${runId}`),
          fetch(`${apiBaseUrl}/api/runs/${runId}/files`)
        ]);

        if (!runsResponse.ok) {
          throw new Error(`HTTP ${runsResponse.status}`);
        }

        if (!detailResponse.ok) {
          throw new Error(`HTTP ${detailResponse.status}`);
        }

        if (!filesResponse.ok) {
          throw new Error(`HTTP ${filesResponse.status}`);
        }

        const runsPayload = (await runsResponse.json()) as RunSummary[];
        const detailPayload = (await detailResponse.json()) as RunRecord;
        const filesPayload = (await filesResponse.json()) as RunFilesPayload;

        setRuns(runsPayload);
        setSelectedRun(detailPayload);
        setRunFiles(filesPayload.files);
        setFilesError(null);
        setDetailError(null);
        setSelectedSourceFilePath((currentPath) => {
          if (!currentPath) {
            return null;
          }

          return currentPath.startsWith(`${detailPayload.targetPath}/`) ? currentPath : null;
        });
      } catch (pollError) {
        const message = pollError instanceof Error ? pollError.message : String(pollError);
        setDetailError(message);
      }
    }

    if (!selectedRunId || !selectedRun || selectedRun.status !== "running") {
      return;
    }

    const intervalId = window.setInterval(() => {
      void pollRunningRun(selectedRunId);
    }, runningPollIntervalMs);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [apiBaseUrl, selectedRun, selectedRunId]);

  useEffect(() => {
    if (!selectedRun) {
      setIssuePage(0);
      return;
    }

    if (selectedRun.issues.length === 0) {
      setSelectedIssueIndex(0);
      setIssuePage(0);
      return;
    }

    const clampedIssueIndex = Math.min(Math.max(0, selectedIssueIndex), selectedRun.issues.length - 1);
    if (clampedIssueIndex !== selectedIssueIndex) {
      setSelectedIssueIndex(clampedIssueIndex);
      return;
    }

    const derivedIssuePage = Math.floor(clampedIssueIndex / detailPageSize);
    if (derivedIssuePage !== issuePage) {
      setIssuePage(derivedIssuePage);
    }
  }, [issuePage, selectedIssueIndex, selectedRun]);

  useEffect(() => {
    if (!selectedRun || selectedRun.logs.length === 0) {
      if (logPage !== 0) {
        setLogPage(0);
      }
      return;
    }

    const maxLogPage = Math.max(0, Math.ceil(selectedRun.logs.length / detailPageSize) - 1);
    const clampedLogPage = Math.min(Math.max(0, logPage), maxLogPage);
    if (clampedLogPage !== logPage) {
      setLogPage(clampedLogPage);
    }
  }, [logPage, selectedRun]);

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
        <div className="header-actions">
          <label>
            Status
            <select
              value={runsStatusFilter}
              onChange={(event) => {
                const value = event.target.value;
                if (value === "running" || value === "finished") {
                  setRunsStatusFilter(value);
                  return;
                }

                setRunsStatusFilter("all");
              }}
            >
              <option value="all">All</option>
              <option value="running">Running</option>
              <option value="finished">Finished</option>
            </select>
          </label>
          <button onClick={() => void loadRuns()} disabled={loading}>
            {loading ? "Loading..." : "Refresh"}
          </button>
        </div>
      </header>

      {error ? <p className="error">Could not load runs: {error}</p> : null}

      {!loading && runs.length === 0 ? <p className="empty">No runs yet.</p> : null}

      {filteredRuns.length > 0 ? (
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
            {filteredRuns.map((run) => (
              <tr
                key={run.runId}
                className={run.runId === selectedRunId ? "selected" : ""}
                onClick={() => {
                  setSelectedRunId(run.runId);
                  setSelectedIssueIndex(0);
                  setSelectedSourceFilePath(null);
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

      {!loading && runs.length > 0 && filteredRuns.length === 0 ? (
        <p className="empty">No runs match current status filter.</p>
      ) : null}

      {selectedRunId ? (
        <section className="detail-panel">
          <h2>Run detail</h2>
          {detailLoading ? <p className="empty">Loading selected run...</p> : null}
          {detailError ? <p className="error">Could not load run detail: {detailError}</p> : null}

          {!detailLoading && !detailError && selectedRun ? (
            <>
              <p className="mono">{selectedRun.runId}</p>
              <p>
                Status: {selectedRun.status} · Exit: {selectedRun.exitCode ?? "-"}
                {selectedRun.status === "running" ? <span className="live-badge">Live updating</span> : null}
              </p>
              <p className="mono">Target: {selectedRun.targetPath}</p>
              <p>Logs: {selectedRun.logs.length} · Issues: {selectedRun.issues.length}</p>

              <section className="detail-block">
                <div className="detail-block-header">
                  <h3>Files</h3>
                  <input
                    type="search"
                    placeholder="Filter files"
                    value={fileSearchTerm}
                    onChange={(event) => {
                      setFileSearchTerm(event.target.value);
                    }}
                  />
                </div>

                {filesLoading ? <p className="empty">Loading files...</p> : null}
                {filesError ? <p className="error">Could not load files: {filesError}</p> : null}

                {!filesLoading && !filesError && visibleRunFiles.length > 0 ? (
                  <ul className="detail-list">
                    {visibleRunFiles.slice(0, 30).map((fileEntry) => (
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

                {!filesLoading && !filesError && runFiles.length > 0 && visibleRunFiles.length === 0 ? (
                  <p className="empty">No files match current filter.</p>
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
