import type { RunRecord } from "../types.js";

interface RunStarterProps {
  startRunTargetPath: string;
  setStartRunTargetPath: (value: string) => void;
  setStartRunError: (value: string | null) => void;
  startRunFromUi: () => Promise<boolean>;
  starterTargetPresets: string[];
  selectedRun: RunRecord | null;
  startRunLoading: boolean;
}

export function RunStarter({
  startRunTargetPath,
  setStartRunTargetPath,
  setStartRunError,
  startRunFromUi,
  starterTargetPresets,
  selectedRun,
  startRunLoading
}: RunStarterProps): JSX.Element {
  return (
    <section className="run-starter">
      <label>
        Target path
        <input
          type="text"
          value={startRunTargetPath}
          onChange={(event) => {
            setStartRunTargetPath(event.target.value);
            setStartRunError(null);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              void startRunFromUi();
            }
          }}
        />
      </label>
      <div className="run-starter-presets">
        {starterTargetPresets.map((targetPreset) => (
          <button
            key={targetPreset}
            onClick={() => {
              setStartRunTargetPath(targetPreset);
              setStartRunError(null);
            }}
          >
            {targetPreset.split("/").pop()}
          </button>
        ))}
      </div>
      <div className="run-starter-actions">
        <button
          onClick={() => {
            setStartRunTargetPath("/workspace/examples/php-sample");
            setStartRunError(null);
          }}
        >
          Reset target
        </button>
        <button
          onClick={() => {
            if (selectedRun) {
              setStartRunTargetPath(selectedRun.targetPath);
              setStartRunError(null);
            }
          }}
          disabled={!selectedRun}
        >
          Use selected target
        </button>
        <button
          onClick={() => {
            void startRunFromUi();
          }}
          disabled={startRunLoading || startRunTargetPath.trim().length === 0}
        >
          {startRunLoading ? "Starting..." : "Start run"}
        </button>
      </div>
    </section>
  );
}