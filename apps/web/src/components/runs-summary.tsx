interface RunsSummaryProps {
  total: number;
  running: number;
  finished: number;
  lastRefreshAt: string | null;
  isAutoRunEnabled: boolean;
  autoRunTargetMode: "starter" | "selected";
  isAutoRunUsingStarterFallback: boolean;
  autoRunCountdownSec: number;
  autoRunEffectiveIntervalMs: number;
  resolvedAutoRunTargetPath: string;
  autoRunPauseWhenHidden: boolean;
  isDocumentHidden: boolean;
  lastAutoRunAt: string | null;
  lastAutoRunError: string | null;
  isLlmAvailable: boolean | null;
  activeAiProvider: string | null;
  activeAiModel: string | null;
  autoRunTriggerCount: number;
  autoRunFailureCount: number;
  autoRunConsecutiveFailures: number;
  autoRunDisabledReason: string | null;
}

export function RunsSummary({
  total,
  running,
  finished,
  lastRefreshAt,
  isAutoRunEnabled,
  autoRunTargetMode,
  isAutoRunUsingStarterFallback,
  autoRunCountdownSec,
  autoRunEffectiveIntervalMs,
  resolvedAutoRunTargetPath,
  autoRunPauseWhenHidden,
  isDocumentHidden,
  lastAutoRunAt,
  lastAutoRunError,
  isLlmAvailable,
  activeAiProvider,
  activeAiModel,
  autoRunTriggerCount,
  autoRunFailureCount,
  autoRunConsecutiveFailures,
  autoRunDisabledReason
}: RunsSummaryProps): JSX.Element {
  return (
    <section className="runs-summary">
      <span>All: {total}</span>
      <span>Running: {running}</span>
      <span>Finished: {finished}</span>
      {lastRefreshAt ? <span>Last refresh: {new Date(lastRefreshAt).toLocaleTimeString()}</span> : null}
      <span>Auto-run: {isAutoRunEnabled ? "ON" : "OFF"}</span>
      {isAutoRunEnabled ? <span>Auto mode: {autoRunTargetMode}</span> : null}
      {isAutoRunEnabled && isAutoRunUsingStarterFallback ? <span>Auto mode fallback: using starter target (no selected run)</span> : null}
      {isAutoRunEnabled ? <span>Next auto-run in: {autoRunCountdownSec}s</span> : null}
      {isAutoRunEnabled ? <span>Auto effective interval: {Math.round(autoRunEffectiveIntervalMs / 1000)}s</span> : null}
      {isAutoRunEnabled ? <span>Auto target path: {resolvedAutoRunTargetPath || "(empty)"}</span> : null}
      {isAutoRunEnabled && autoRunPauseWhenHidden && isDocumentHidden ? <span>Auto-run paused: tab hidden</span> : null}
      {isAutoRunEnabled && running > 0 ? <span>Auto-run waiting for active run</span> : null}
      {lastAutoRunAt ? <span>Last auto-run: {new Date(lastAutoRunAt).toLocaleTimeString()}</span> : null}
      {lastAutoRunError ? <span>Auto-run error: {lastAutoRunError}</span> : null}
      <span>LLM: {isLlmAvailable === null ? "..." : isLlmAvailable ? "ON" : "OFF"}</span>
      {activeAiProvider ? <span>AI provider: {activeAiProvider}</span> : null}
      {activeAiModel ? <span>AI model: {activeAiModel}</span> : null}
      <span>Auto-run triggers: {autoRunTriggerCount}</span>
      <span>Auto-run failures: {autoRunFailureCount}</span>
      {autoRunConsecutiveFailures > 0 ? <span>Auto-run consecutive failures: {autoRunConsecutiveFailures}</span> : null}
      {!isAutoRunEnabled && autoRunDisabledReason ? <span>Auto-run paused reason: {autoRunDisabledReason}</span> : null}
    </section>
  );
}