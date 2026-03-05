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

              {selectedRun.issues.length > 0 ? (
                <ul className="detail-list">
                  {selectedRun.issues.slice(0, 10).map((issue, index) => (
                    <li key={`${issue.file}-${issue.line}-${index}`}>
                      <span className="mono">{issue.file}:{issue.line}</span> — {issue.message}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="empty">No issues in selected run.</p>
              )}
            </>
          ) : null}
        </section>
      ) : null}
    </main>
  );
}
