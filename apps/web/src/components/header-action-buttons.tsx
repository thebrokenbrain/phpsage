import type { AiIngestJobPayload } from "../types.js";

interface HeaderActionButtonsProps {
  startRunLoading: boolean;
  resolvedAutoRunTargetPath: string;
  startRunFromUi: (targetPathOverride?: string, triggerSource?: "manual" | "auto") => Promise<boolean>;
  copyCurrentDeepLink: () => Promise<void>;
  copyLinkStatus: "idle" | "copied" | "error";
  resetDashboardControls: () => void;
  autoRunTriggerCount: number;
  setAutoRunTriggerCount: (value: number) => void;
  autoRunFailureCount: number;
  autoRunConsecutiveFailures: number;
  lastAutoRunError: string | null;
  setAutoRunFailureCount: (value: number) => void;
  setAutoRunConsecutiveFailures: (value: number) => void;
  setAutoRunDisabledReason: (value: string | null) => void;
  setLastAutoRunError: (value: string | null) => void;
  isAutoRunEnabled: boolean;
  setIsAutoRunEnabled: (value: boolean) => void;
  setAutoRunCountdownSec: (value: number) => void;
  autoRunEffectiveIntervalMs: number;
  lastAutoRunAt: string | null;
  setLastAutoRunAt: (value: string | null) => void;
  autoRunDisabledReason: string | null;
  latestRunningRunId: string | null;
  setSelectedRunId: (value: string | null) => void;
  setSelectedIssueIndex: (value: number) => void;
  setSelectedSourceFilePath: (value: string | null) => void;
  selectedRunId: string | null;
  refreshRuns: () => Promise<void>;
  loading: boolean;
  ingestTargetPath: string;
  ingestLoading: boolean;
  startIngestFromUi: (targetPath?: string) => Promise<void>;
  activeIngestJob: AiIngestJobPayload | null;
}

export function HeaderActionButtons({
  startRunLoading,
  resolvedAutoRunTargetPath,
  startRunFromUi,
  copyCurrentDeepLink,
  copyLinkStatus,
  resetDashboardControls,
  autoRunTriggerCount,
  setAutoRunTriggerCount,
  autoRunFailureCount,
  autoRunConsecutiveFailures,
  lastAutoRunError,
  setAutoRunFailureCount,
  setAutoRunConsecutiveFailures,
  setAutoRunDisabledReason,
  setLastAutoRunError,
  isAutoRunEnabled,
  setIsAutoRunEnabled,
  setAutoRunCountdownSec,
  autoRunEffectiveIntervalMs,
  lastAutoRunAt,
  setLastAutoRunAt,
  autoRunDisabledReason,
  latestRunningRunId,
  setSelectedRunId,
  setSelectedIssueIndex,
  setSelectedSourceFilePath,
  selectedRunId,
  refreshRuns,
  loading,
  ingestTargetPath,
  ingestLoading,
  startIngestFromUi,
  activeIngestJob
}: HeaderActionButtonsProps): JSX.Element {
  const ingestButtonLabel = ingestLoading
    ? "Starting ingest..."
    : activeIngestJob && (activeIngestJob.status === "queued" || activeIngestJob.status === "running")
      ? `Ingest ${activeIngestJob.status}...`
      : "Start ingest";

  return (
    <>
      <button
        onClick={() => {
          void (async () => {
            await startRunFromUi(resolvedAutoRunTargetPath);
          })();
        }}
        disabled={startRunLoading || resolvedAutoRunTargetPath.trim().length === 0}
      >
        Run now
      </button>
      <button
        onClick={() => {
          void startIngestFromUi(ingestTargetPath);
        }}
        disabled={ingestLoading || ingestTargetPath.trim().length === 0 || activeIngestJob?.status === "running"}
      >
        {ingestButtonLabel}
      </button>
      <button
        onClick={() => {
          void copyCurrentDeepLink();
        }}
      >
        {copyLinkStatus === "copied" ? "Link copied" : "Copy link"}
      </button>
      <button
        onClick={() => {
          resetDashboardControls();
        }}
      >
        Reset controls
      </button>
      <button
        onClick={() => {
          setAutoRunTriggerCount(0);
        }}
        disabled={autoRunTriggerCount === 0}
      >
        Reset auto count
      </button>
      <button
        onClick={() => {
          setAutoRunFailureCount(0);
          setAutoRunConsecutiveFailures(0);
          setAutoRunDisabledReason(null);
          setLastAutoRunError(null);
        }}
        disabled={autoRunFailureCount === 0 && autoRunConsecutiveFailures === 0 && !lastAutoRunError}
      >
        Reset auto failures
      </button>
      <button
        onClick={() => {
          setIsAutoRunEnabled(true);
          setLastAutoRunError(null);
          setAutoRunDisabledReason(null);
          setAutoRunConsecutiveFailures(0);
          setAutoRunCountdownSec(Math.ceil(autoRunEffectiveIntervalMs / 1000));
        }}
        disabled={isAutoRunEnabled}
      >
        Re-enable auto-run
      </button>
      <button
        onClick={() => {
          setLastAutoRunAt(null);
          setLastAutoRunError(null);
          setAutoRunDisabledReason(null);
        }}
        disabled={!lastAutoRunAt && !lastAutoRunError && !autoRunDisabledReason}
      >
        Clear auto status
      </button>
      <button
        onClick={() => {
          if (typeof window !== "undefined") {
            window.open("http://localhost:8081", "_blank", "noopener,noreferrer");
          }
        }}
      >
        API docs
      </button>
      <button
        onClick={() => {
          if (latestRunningRunId) {
            setSelectedRunId(latestRunningRunId);
            setSelectedIssueIndex(0);
            setSelectedSourceFilePath(null);
          }
        }}
        disabled={!latestRunningRunId}
      >
        Jump to running
      </button>
      <button
        onClick={() => {
          setSelectedRunId(null);
          setSelectedSourceFilePath(null);
        }}
        disabled={!selectedRunId}
      >
        Clear selection
      </button>
      <button onClick={() => void refreshRuns()} disabled={loading}>
        {loading ? "Loading..." : "Refresh"}
      </button>
    </>
  );
}