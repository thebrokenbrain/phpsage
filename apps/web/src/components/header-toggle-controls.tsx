interface HeaderToggleControlsProps {
  isLivePollingEnabled: boolean;
  setIsLivePollingEnabled: (value: boolean) => void;
  isAutoRunEnabled: boolean;
  setIsAutoRunEnabled: (value: boolean) => void;
  setLastAutoRunError: (value: string | null) => void;
  setAutoRunDisabledReason: (value: string | null) => void;
  setAutoRunCountdownSec: (value: number) => void;
  autoRunEffectiveIntervalMs: number;
  autoRunPauseWhenHidden: boolean;
  setAutoRunPauseWhenHidden: (value: boolean) => void;
}

export function HeaderToggleControls({
  isLivePollingEnabled,
  setIsLivePollingEnabled,
  isAutoRunEnabled,
  setIsAutoRunEnabled,
  setLastAutoRunError,
  setAutoRunDisabledReason,
  setAutoRunCountdownSec,
  autoRunEffectiveIntervalMs,
  autoRunPauseWhenHidden,
  setAutoRunPauseWhenHidden
}: HeaderToggleControlsProps): JSX.Element {
  return (
    <>
      <label className="toggle-label">
        <input
          type="checkbox"
          checked={isLivePollingEnabled}
          onChange={(event) => {
            setIsLivePollingEnabled(event.target.checked);
          }}
        />
        Live polling
      </label>
      <label className="toggle-label">
        <input
          type="checkbox"
          checked={isAutoRunEnabled}
          onChange={(event) => {
            setIsAutoRunEnabled(event.target.checked);
            if (event.target.checked) {
              setLastAutoRunError(null);
              setAutoRunDisabledReason(null);
              setAutoRunCountdownSec(Math.ceil(autoRunEffectiveIntervalMs / 1000));
            }
          }}
        />
        Auto-run
      </label>
      <label className="toggle-label">
        <input
          type="checkbox"
          checked={autoRunPauseWhenHidden}
          onChange={(event) => {
            setAutoRunPauseWhenHidden(event.target.checked);
          }}
        />
        Pause when hidden
      </label>
    </>
  );
}