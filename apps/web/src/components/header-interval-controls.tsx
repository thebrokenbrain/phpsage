interface HeaderIntervalControlsProps {
  livePollingIntervalMs: number;
  setLivePollingIntervalMs: (value: number) => void;
  autoRunIntervalMs: number;
  setAutoRunIntervalMs: (value: number) => void;
  autoRunMaxFailures: number;
  setAutoRunMaxFailures: (value: number) => void;
  autoRunTargetMode: "starter" | "selected";
  setAutoRunTargetMode: (value: "starter" | "selected") => void;
}

export function HeaderIntervalControls({
  livePollingIntervalMs,
  setLivePollingIntervalMs,
  autoRunIntervalMs,
  setAutoRunIntervalMs,
  autoRunMaxFailures,
  setAutoRunMaxFailures,
  autoRunTargetMode,
  setAutoRunTargetMode
}: HeaderIntervalControlsProps): JSX.Element {
  return (
    <>
      <label>
        Interval
        <select
          value={livePollingIntervalMs}
          onChange={(event) => {
            const nextValue = Number.parseInt(event.target.value, 10);
            if (Number.isFinite(nextValue) && nextValue > 0) {
              setLivePollingIntervalMs(nextValue);
            }
          }}
        >
          <option value={2000}>2s</option>
          <option value={5000}>5s</option>
          <option value={10000}>10s</option>
        </select>
      </label>
      <label>
        Auto interval
        <select
          value={autoRunIntervalMs}
          onChange={(event) => {
            const nextValue = Number.parseInt(event.target.value, 10);
            if (Number.isFinite(nextValue) && nextValue > 0) {
              setAutoRunIntervalMs(nextValue);
            }
          }}
        >
          <option value={10000}>10s</option>
          <option value={15000}>15s</option>
          <option value={30000}>30s</option>
          <option value={60000}>60s</option>
        </select>
      </label>
      <label>
        Auto max failures
        <select
          value={autoRunMaxFailures}
          onChange={(event) => {
            const nextValue = Number.parseInt(event.target.value, 10);
            if (Number.isFinite(nextValue) && nextValue > 0) {
              setAutoRunMaxFailures(nextValue);
            }
          }}
        >
          <option value={1}>1</option>
          <option value={3}>3</option>
          <option value={5}>5</option>
        </select>
      </label>
      <label>
        Auto target
        <select
          value={autoRunTargetMode}
          onChange={(event) => {
            const value = event.target.value;
            if (value === "selected") {
              setAutoRunTargetMode("selected");
              return;
            }

            setAutoRunTargetMode("starter");
          }}
        >
          <option value="starter">Starter target</option>
          <option value="selected">Selected run target</option>
        </select>
      </label>
    </>
  );
}