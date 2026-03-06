interface SelectionEmptyProps {
  latestRunningRunId: string | null;
  onJumpToRunning: (runId: string) => void;
}

export function SelectionEmpty({ latestRunningRunId, onJumpToRunning }: SelectionEmptyProps): JSX.Element {
  return (
    <section className="selection-empty">
      <p>Select a run from the table to inspect details.</p>
      <button
        onClick={() => {
          if (latestRunningRunId) {
            onJumpToRunning(latestRunningRunId);
          }
        }}
        disabled={!latestRunningRunId}
      >
        Jump to running
      </button>
    </section>
  );
}