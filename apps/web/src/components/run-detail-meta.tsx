import type { RunRecord } from "../types.js";

interface RunDetailMetaProps {
  detailLoading: boolean;
  detailError: string | null;
  selectedRun: RunRecord | null;
  copyRunIdStatus: "idle" | "copied" | "error";
  copyRunId: () => Promise<void>;
}

export function RunDetailMeta({
  detailLoading,
  detailError,
  selectedRun,
  copyRunIdStatus,
  copyRunId
}: RunDetailMetaProps): JSX.Element {
  return (
    <>
      <h2>Run detail</h2>
      {detailLoading ? <p className="empty">Loading selected run...</p> : null}
      {detailError ? <p className="error">Could not load run detail: {detailError}</p> : null}

      {!detailLoading && !detailError && selectedRun ? (
        <>
          <p className="mono">{selectedRun.runId}</p>
          <button
            onClick={() => {
              void copyRunId();
            }}
          >
            {copyRunIdStatus === "copied" ? "Run ID copied" : "Copy run ID"}
          </button>
          <p>
            Status: {selectedRun.status} · Exit: {selectedRun.exitCode ?? "-"}
            {selectedRun.status === "running" ? <span className="live-badge">Live updating</span> : null}
          </p>
          <p>
            Created: {new Date(selectedRun.createdAt).toLocaleString()} · Updated: {new Date(selectedRun.updatedAt).toLocaleString()}
          </p>
          <p className="mono">Target: {selectedRun.targetPath}</p>
          <p>Logs: {selectedRun.logs.length} · Issues: {selectedRun.issues.length}</p>

          {copyRunIdStatus === "error" ? <p className="error">Could not copy run ID.</p> : null}
        </>
      ) : null}
    </>
  );
}