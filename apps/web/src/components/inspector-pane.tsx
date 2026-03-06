import type { JSX } from "react";
import { SelectionEmpty } from "./selection-empty.js";

interface InspectorPaneProps {
  selectedRunId: string | null;
  loading: boolean;
  runsCount: number;
  latestRunningRunId: string | null;
  onJumpToRunning: (runId: string) => void;
  detailPanel: JSX.Element | null;
}

export function InspectorPane({
  selectedRunId,
  loading,
  runsCount,
  latestRunningRunId,
  onJumpToRunning,
  detailPanel
}: InspectorPaneProps): JSX.Element {
  return (
    <div className="inspector-pane">
      <div className="pane-header">
        <h2>Inspector</h2>
        <span className="pane-meta">{selectedRunId ? "run selected" : "no selection"}</span>
      </div>

      {!loading && runsCount > 0 && !selectedRunId ? (
        <SelectionEmpty
          latestRunningRunId={latestRunningRunId}
          onJumpToRunning={onJumpToRunning}
        />
      ) : null}

      {detailPanel}
    </div>
  );
}