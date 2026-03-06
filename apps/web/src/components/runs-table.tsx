import type { RunSummary } from "../types.js";

interface RunsTableProps {
  visibleRuns: RunSummary[];
  selectedRunId: string | null;
  onSelectRun: (runId: string) => void;
}

export function RunsTable({ visibleRuns, selectedRunId, onSelectRun }: RunsTableProps): JSX.Element {
  return (
    <div className="runs-table-wrap">
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
          {visibleRuns.map((run) => (
            <tr
              key={run.runId}
              className={run.runId === selectedRunId ? "selected" : ""}
              onClick={() => {
                onSelectRun(run.runId);
              }}
            >
              <td className="mono">{run.runId.slice(0, 8)}</td>
              <td>
                <span className={`status-pill ${run.status === "running" ? "status-running" : "status-finished"}`}>
                  {run.status}
                </span>
              </td>
              <td>
                <span className="exit-pill">{run.exitCode ?? "-"}</span>
              </td>
              <td>
                <span className={`issues-pill ${run.issueCount > 0 ? "issues-pill-has" : ""}`}>{run.issueCount}</span>
              </td>
              <td className="mono">{run.targetPath}</td>
              <td>{new Date(run.updatedAt).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}