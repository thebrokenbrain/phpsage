import type { RunSummary } from "../types.js";
import { RunsTable } from "./runs-table.js";

interface RunsPaneProps {
  visibleRuns: RunSummary[];
  selectedRunId: string | null;
  onSelectRun: (runId: string) => void;
  error: string | null;
  loading: boolean;
  runsCount: number;
}

export function RunsPane({
  visibleRuns,
  selectedRunId,
  onSelectRun,
  error,
  loading,
  runsCount
}: RunsPaneProps): JSX.Element {
  return (
    <div className="runs-pane">
      <div className="pane-header">
        <h2>Runs</h2>
        <span className="pane-meta">{visibleRuns.length} visible</span>
      </div>

      {error ? <p className="error">Could not load runs: {error}</p> : null}

      {!loading && runsCount === 0 ? <p className="empty">No runs yet.</p> : null}

      {visibleRuns.length > 0 ? (
        <RunsTable
          visibleRuns={visibleRuns}
          selectedRunId={selectedRunId}
          onSelectRun={onSelectRun}
        />
      ) : null}

      {!loading && runsCount > 0 && visibleRuns.length === 0 ? (
        <p className="empty">No runs match current status filter.</p>
      ) : null}
    </div>
  );
}