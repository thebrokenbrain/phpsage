import { useEffect, useMemo, useState } from "react";
import type {
  RunFileItem,
  RunFilesPayload,
  RunIssue,
  RunLogEntry,
  RunRecord,
  RunSummary,
  SourcePayload
} from "./types.js";
import { useAiAssistance } from "./hooks/use-ai-assistance.js";
import { useKeyboardIssueNavigation } from "./hooks/use-keyboard-issue-navigation.js";
import { useIssueNavigation } from "./hooks/use-issue-navigation.js";
import { useRunViewModel } from "./hooks/use-run-view-model.js";
import { useRunSource } from "./hooks/use-run-source.js";
import { useUrlPopstateSync } from "./hooks/use-url-popstate-sync.js";
import { useDashboardUrlSync } from "./hooks/use-dashboard-url-sync.js";
import { useRunDetail } from "./hooks/use-run-detail.js";
import { useRunFiles } from "./hooks/use-run-files.js";
import { useAiHealth } from "./hooks/use-ai-health.js";
import { useAutoRunCountdown } from "./hooks/use-auto-run-countdown.js";
import { useAutoRunVisibilityPause } from "./hooks/use-auto-run-visibility-pause.js";
import { useAutoRunScheduler } from "./hooks/use-auto-run-scheduler.js";
import { useRunningRunPolling } from "./hooks/use-running-run-polling.js";
import { useDashboardStorage } from "./hooks/use-dashboard-storage.js";
import { useDashboardPagination } from "./hooks/use-dashboard-pagination.js";
import { useRunsList } from "./hooks/use-runs-list.js";
import { useCopyActions } from "./hooks/use-copy-actions.js";
import { useRunsFiltersViewModel } from "./hooks/use-runs-filters-view-model.js";
import { useAutoRunDerived } from "./hooks/use-auto-run-derived.js";
import { useStartRun } from "./hooks/use-start-run.js";
import { useResetDashboardControls } from "./hooks/use-reset-dashboard-controls.js";
import { readInitialQuerySelection } from "./hooks/use-initial-query-selection.js";
import { useSelectedSourceFileGuard } from "./hooks/use-selected-source-file-guard.js";
import { useAutoRunErrorReset } from "./hooks/use-auto-run-error-reset.js";

const defaultApiBaseUrl = "http://localhost:8080";
const detailPageSize = 10;
const defaultRunningPollIntervalMs = 2000;
const aiHealthFailureThreshold = 2;
const starterTargetPresets = ["/workspace/examples/php-sample", "/workspace/examples/php-sample-ok"];

export function App(): JSX.Element {
  const initialSelection = useMemo(() => readInitialQuerySelection(), []);
  const apiBaseUrl = useMemo(() => {
    const value = import.meta.env.VITE_API_BASE_URL as string | undefined;
    return value && value.trim().length > 0 ? value : defaultApiBaseUrl;
  }, []);

  const [runsStatusFilter, setRunsStatusFilter] = useState<"all" | "running" | "finished">(initialSelection.runsStatusFilter);
  const [runsSortOrder, setRunsSortOrder] = useState<"updatedDesc" | "updatedAsc">(initialSelection.runsSortOrder);
  const [isAutoRunEnabled, setIsAutoRunEnabled] = useState(initialSelection.isAutoRunEnabled);
  const [autoRunIntervalMs, setAutoRunIntervalMs] = useState(initialSelection.autoRunIntervalMs ?? 15000);
  const [autoRunTargetMode, setAutoRunTargetMode] = useState<"starter" | "selected">(initialSelection.autoRunTargetMode);
  const [autoRunPauseWhenHidden, setAutoRunPauseWhenHidden] = useState(initialSelection.autoRunPauseWhenHidden);
  const [autoRunMaxFailures, setAutoRunMaxFailures] = useState(initialSelection.autoRunMaxFailures ?? 3);
  const [autoRunConsecutiveFailures, setAutoRunConsecutiveFailures] = useState(0);
  const [lastAutoRunAt, setLastAutoRunAt] = useState<string | null>(null);
  const [lastAutoRunError, setLastAutoRunError] = useState<string | null>(null);
  const [autoRunTriggerCount, setAutoRunTriggerCount] = useState(0);
  const [autoRunFailureCount, setAutoRunFailureCount] = useState(0);
  const [autoRunDisabledReason, setAutoRunDisabledReason] = useState<string | null>(null);
  const [isLivePollingEnabled, setIsLivePollingEnabled] = useState(initialSelection.isLivePollingEnabled);
  const [livePollingIntervalMs, setLivePollingIntervalMs] = useState(initialSelection.livePollingIntervalMs ?? defaultRunningPollIntervalMs);
  const [startRunTargetPath, setStartRunTargetPath] = useState(initialSelection.startTargetPath ?? "/workspace/examples/php-sample");
  const [issuePage, setIssuePage] = useState(0);
  const [issueSearchTerm, setIssueSearchTerm] = useState(initialSelection.issueSearchTerm);
  const [issueIdentifierFilter, setIssueIdentifierFilter] = useState<"all" | "with" | "without">(initialSelection.issueIdentifierFilter);
  const [isIssuesSectionOpen, setIsIssuesSectionOpen] = useState(initialSelection.isIssuesSectionOpen);
  const [isLogsSectionOpen, setIsLogsSectionOpen] = useState(initialSelection.isLogsSectionOpen);
  const [logPage, setLogPage] = useState(initialSelection.logPage ?? 0);
  const [logSearchTerm, setLogSearchTerm] = useState(initialSelection.logSearchTerm);
  const [logStreamFilter, setLogStreamFilter] = useState<"all" | "stdout" | "stderr">(initialSelection.logStreamFilter);
  const [selectedIssueIndex, setSelectedIssueIndex] = useState(initialSelection.issueIndex ?? 0);
  const [isFilesSectionOpen, setIsFilesSectionOpen] = useState(initialSelection.isFilesSectionOpen);
  const [fileSearchTerm, setFileSearchTerm] = useState(initialSelection.fileSearchTerm);
  const [selectedSourceFilePath, setSelectedSourceFilePath] = useState<string | null>(initialSelection.file);
  const [isSourceSectionOpen, setIsSourceSectionOpen] = useState(initialSelection.isSourceSectionOpen);
  const {
    runs,
    setRuns,
    loading,
    error,
    setError,
    lastRefreshAt,
    setLastRefreshAt,
    selectedRunId,
    setSelectedRunId,
    refreshRuns
  } = useRunsList({
    apiBaseUrl,
    initialSelectedRunId: initialSelection.runId
  });

  const {
    selectedRun,
    detailLoading,
    detailError,
    refreshRunDetail
  } = useRunDetail({
    apiBase: apiBaseUrl,
    runId: selectedRunId
  });

  const {
    runFiles,
    filesLoading,
    filesError,
    refreshRunFiles
  } = useRunFiles({
    apiBase: apiBaseUrl,
    runId: selectedRunId
  });

  const {
    isLlmAvailable,
    activeAiProvider,
    activeAiModel
  } = useAiHealth({
    apiBase: apiBaseUrl,
    failureThreshold: aiHealthFailureThreshold
  });

  const {
    visibleRuns,
    runsSummary,
    activeControlLabels,
    latestRunningRunId
  } = useRunsFiltersViewModel({
    runs,
    runsStatusFilter,
    runsSortOrder,
    fileSearchTerm,
    issueSearchTerm,
    issueIdentifierFilter,
    logSearchTerm,
    logStreamFilter,
    isLivePollingEnabled,
    livePollingIntervalMs,
    defaultRunningPollIntervalMs,
    isAutoRunEnabled,
    autoRunIntervalMs,
    autoRunTargetMode,
    autoRunPauseWhenHidden,
    autoRunMaxFailures,
    autoRunConsecutiveFailures
  });

  const {
    resolvedAutoRunTargetPath,
    isAutoRunUsingStarterFallback,
    autoRunEffectiveIntervalMs
  } = useAutoRunDerived({
    autoRunTargetMode,
    selectedRun,
    startRunTargetPath,
    autoRunConsecutiveFailures,
    autoRunIntervalMs
  });

  const {
    startRunLoading,
    startRunError,
    setStartRunError,
    startRunFromUi
  } = useStartRun({
    apiBaseUrl,
    startRunTargetPath,
    autoRunEffectiveIntervalMs,
    autoRunMaxFailures,
    setSelectedRunId,
    refreshRuns,
    setAutoRunCountdownSec,
    setLastAutoRunError,
    setAutoRunFailureCount,
    setAutoRunConsecutiveFailures,
    setAutoRunDisabledReason,
    setIsAutoRunEnabled
  });

  const {
    copyLinkStatus,
    copyRunIdStatus,
    copyCurrentDeepLink,
    copyRunId
  } = useCopyActions({
    selectedRunId: selectedRun?.runId ?? null
  });

  const { resetDashboardControls } = useResetDashboardControls({
    setRunsStatusFilter,
    setRunsSortOrder,
    setIssueSearchTerm,
    setIssueIdentifierFilter,
    setLogSearchTerm,
    setLogStreamFilter,
    setFileSearchTerm,
    setIsLivePollingEnabled,
    setLivePollingIntervalMs,
    defaultRunningPollIntervalMs,
    setIsFilesSectionOpen,
    setIsIssuesSectionOpen,
    setIsSourceSectionOpen,
    setIsLogsSectionOpen,
    setAutoRunPauseWhenHidden,
    setAutoRunMaxFailures
  });

  useSelectedSourceFileGuard({
    selectedRun,
    setSelectedSourceFilePath
  });

  useAutoRunErrorReset({
    autoRunIntervalMs,
    autoRunMaxFailures,
    autoRunPauseWhenHidden,
    autoRunTargetMode,
    setLastAutoRunError
  });

  const {
    autoRunCountdownSec,
    setAutoRunCountdownSec
  } = useAutoRunCountdown({
    isAutoRunEnabled,
    effectiveIntervalMs: autoRunEffectiveIntervalMs
  });

  useAutoRunVisibilityPause({
    isAutoRunEnabled,
    autoRunPauseWhenHidden,
    autoRunEffectiveIntervalMs,
    setAutoRunDisabledReason,
    setAutoRunCountdownSec
  });

  useAutoRunScheduler({
    isAutoRunEnabled,
    autoRunPauseWhenHidden,
    autoRunEffectiveIntervalMs,
    resolvedAutoRunTargetPath,
    runs,
    startRunLoading,
    setLastAutoRunAt,
    setAutoRunTriggerCount,
    startRunFromUi
  });

  useRunningRunPolling({
    apiBaseUrl,
    isLivePollingEnabled,
    livePollingIntervalMs,
    selectedRunId,
    selectedRunStatus: selectedRun?.status ?? null,
    refreshRunDetail,
    refreshRunFiles,
    setRuns,
    setLastRefreshAt,
    setError
  });

  useDashboardStorage({
    initialStartTargetPath: initialSelection.startTargetPath,
    setStartRunTargetPath,
    isAutoRunEnabled,
    setIsAutoRunEnabled,
    autoRunIntervalMs,
    setAutoRunIntervalMs,
    autoRunTargetMode,
    setAutoRunTargetMode,
    autoRunPauseWhenHidden,
    setAutoRunPauseWhenHidden,
    autoRunMaxFailures,
    setAutoRunMaxFailures,
    startRunTargetPath
  });

  const visibleRunFiles = useMemo(() => {
    const normalizedTerm = fileSearchTerm.trim().toLowerCase();
    if (normalizedTerm.length === 0) {
      return runFiles;
    }

    return runFiles.filter((fileEntry) => fileEntry.path.toLowerCase().includes(normalizedTerm));
  }, [fileSearchTerm, runFiles]);

  const {
    issues,
    safeIssueIndex,
    activeIssue
  } = useRunViewModel({
    selectedRun,
    selectedIssueIndex,
    selectedFilePath: selectedSourceFilePath
  });

  const activeIssueLineInSource = useMemo(() => {
    if (!sourcePayload || !activeIssue) {
      return null;
    }

    if (activeIssue.file !== sourcePayload.file) {
      return null;
    }

    return activeIssue.line;
  }, [activeIssue, sourcePayload]);

  const resolvedSourceFilePath = useMemo(() => {
    if (!selectedRunId || !selectedRun) {
      return null;
    }

    if (selectedSourceFilePath) {
      return selectedSourceFilePath;
    }

    return activeIssue?.file ?? null;
  }, [activeIssue?.file, selectedRun, selectedRunId, selectedSourceFilePath]);

  const {
    sourcePayload,
    sourceLoading,
    sourceError
  } = useRunSource({
    apiBase: apiBaseUrl,
    runId: selectedRunId,
    filePath: resolvedSourceFilePath
  });

  useUrlPopstateSync({
    readSelectionFromUrl: readInitialQuerySelection,
    applySelection: (selection) => {
      setSelectedRunId(selection.runId);
      setSelectedSourceFilePath(selection.file);
      setSelectedIssueIndex(selection.issueIndex ?? 0);
      setLogPage(selection.logPage ?? 0);
      setRunsStatusFilter(selection.runsStatusFilter);
      setRunsSortOrder(selection.runsSortOrder);
      setFileSearchTerm(selection.fileSearchTerm);
      setIssueSearchTerm(selection.issueSearchTerm);
      setIssueIdentifierFilter(selection.issueIdentifierFilter);
      setLogSearchTerm(selection.logSearchTerm);
      setLogStreamFilter(selection.logStreamFilter);
      setIsFilesSectionOpen(selection.isFilesSectionOpen);
      setIsIssuesSectionOpen(selection.isIssuesSectionOpen);
      setIsSourceSectionOpen(selection.isSourceSectionOpen);
      setIsLogsSectionOpen(selection.isLogsSectionOpen);
      setIsAutoRunEnabled(selection.isAutoRunEnabled);
      setAutoRunIntervalMs(selection.autoRunIntervalMs ?? 15000);
      setAutoRunTargetMode(selection.autoRunTargetMode);
      setAutoRunPauseWhenHidden(selection.autoRunPauseWhenHidden);
      setAutoRunMaxFailures(selection.autoRunMaxFailures ?? 3);
      setStartRunTargetPath(selection.startTargetPath ?? "/workspace/examples/php-sample");
      setIsLivePollingEnabled(selection.isLivePollingEnabled);
      setLivePollingIntervalMs(selection.livePollingIntervalMs ?? defaultRunningPollIntervalMs);
    }
  });

  useDashboardUrlSync({
    selectedRunId,
    runsStatusFilter,
    runsSortOrder,
    fileSearchTerm,
    issueSearchTerm,
    issueIdentifierFilter,
    logSearchTerm,
    logStreamFilter,
    isFilesSectionOpen,
    isIssuesSectionOpen,
    isSourceSectionOpen,
    isLogsSectionOpen,
    isAutoRunEnabled,
    autoRunIntervalMs,
    autoRunTargetMode,
    autoRunPauseWhenHidden,
    autoRunMaxFailures,
    startRunTargetPath,
    isLivePollingEnabled,
    livePollingIntervalMs,
    selectedSourceFilePath,
    selectedIssueIndex,
    logPage,
    hasIssuesForSelectedRun: Boolean(selectedRun && selectedRun.issues.length > 0),
    hasLogsForSelectedRun: Boolean(selectedRun && selectedRun.logs.length > 0),
    defaultRunningPollIntervalMs
  });

  const { selectIssueByIndex } = useIssueNavigation({
    issues: selectedRun?.issues ?? [],
    selectedRunTargetPath: selectedRun?.targetPath ?? null,
    setSelectedIssueIndex,
    setSelectedFilePath: setSelectedSourceFilePath
  });

  const activeSourceSnippet = useMemo(() => {
    if (!sourcePayload || !activeIssueLineInSource) {
      return undefined;
    }

    const sourceLines = sourcePayload.content.split("\n");
    return sourceLines[activeIssueLineInSource - 1]?.trim() || undefined;
  }, [activeIssueLineInSource, sourcePayload]);

  const {
    aiExplain,
    aiSuggestFix,
    isAiLoading,
    aiError
  } = useAiAssistance({
    apiBase: apiBaseUrl,
    isLlmAvailable,
    aiContextIssue: activeIssue,
    activeSourceSnippet
  });

  useKeyboardIssueNavigation({
    viewMode: "dashboard",
    issuesLength: issues.length,
    safeIssueIndex,
    onSelectIssueByIndex: selectIssueByIndex
  });

  const filteredIssueEntries = useMemo(() => {
    if (!selectedRun) {
      return [] as Array<{ issue: RunIssue; absoluteIndex: number }>;
    }

    const normalizedSearchTerm = issueSearchTerm.trim().toLowerCase();

    return selectedRun.issues
      .map((issue, absoluteIndex) => ({ issue, absoluteIndex }))
      .filter(({ issue }) => {
        if (issueIdentifierFilter === "with" && !issue.identifier) {
          return false;
        }

        if (issueIdentifierFilter === "without" && issue.identifier) {
          return false;
        }

        if (normalizedSearchTerm.length === 0) {
          return true;
        }

        return `${issue.file}:${issue.line} ${issue.message}`.toLowerCase().includes(normalizedSearchTerm);
      });
  }, [issueIdentifierFilter, issueSearchTerm, selectedRun]);

  const filteredLogs = useMemo(() => {
    if (!selectedRun) {
      return [] as RunLogEntry[];
    }

    const normalizedSearchTerm = logSearchTerm.trim().toLowerCase();

    return selectedRun.logs.filter((logEntry) => {
      if (logStreamFilter !== "all" && logEntry.stream !== logStreamFilter) {
        return false;
      }

      if (normalizedSearchTerm.length === 0) {
        return true;
      }

      return `${logEntry.stream} ${logEntry.message}`.toLowerCase().includes(normalizedSearchTerm);
    });
  }, [logSearchTerm, logStreamFilter, selectedRun]);

  useDashboardPagination({
    selectedRun,
    selectedIssueIndex,
    issuePage,
    setSelectedIssueIndex,
    setIssuePage,
    filteredIssueCount: filteredIssueEntries.length,
    filteredLogCount: filteredLogs.length,
    logPage,
    setLogPage,
    detailPageSize
  });

  return (
    <main className="app">
      <header className="header">
        <div className="brand-group">
          <img className="product-logo" src="/logo/phpsage-logo.png" alt="PHPSage" />
          <div>
            <h1 className="brand-title">Dashboard</h1>
            <p className="brand-subtitle">PHPStan Pro-like run monitoring</p>
            <div className="view-tabs" aria-hidden="true">
              <span className="view-tab view-tab-active">Dashboard</span>
              <span className="view-tab">Insights</span>
              <span className="view-tab">Issue</span>
            </div>
          </div>
        </div>
        <div className="header-actions">
          <label>
            Status
            <select
              value={runsStatusFilter}
              onChange={(event) => {
                const value = event.target.value;
                if (value === "running" || value === "finished") {
                  setRunsStatusFilter(value);
                  return;
                }

                setRunsStatusFilter("all");
              }}
            >
              <option value="all">All</option>
              <option value="running">Running</option>
              <option value="finished">Finished</option>
            </select>
          </label>
          <label>
            Sort
            <select
              value={runsSortOrder}
              onChange={(event) => {
                const value = event.target.value;
                if (value === "updatedAsc") {
                  setRunsSortOrder("updatedAsc");
                  return;
                }

                setRunsSortOrder("updatedDesc");
              }}
            >
              <option value="updatedDesc">Updated ↓</option>
              <option value="updatedAsc">Updated ↑</option>
            </select>
          </label>
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
              setSelectedRun(null);
              setSelectedSourceFilePath(null);
            }}
            disabled={!selectedRunId}
          >
            Clear selection
          </button>
          <button onClick={() => void refreshRuns()} disabled={loading}>
            {loading ? "Loading..." : "Refresh"}
          </button>
        </div>
      </header>

      {copyLinkStatus === "error" ? <p className="error">Could not copy link.</p> : null}

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

      {startRunError ? <p className="error">Could not start run: {startRunError}</p> : null}

      <section className="runs-summary">
        <span>All: {runsSummary.total}</span>
        <span>Running: {runsSummary.running}</span>
        <span>Finished: {runsSummary.finished}</span>
        {lastRefreshAt ? <span>Last refresh: {new Date(lastRefreshAt).toLocaleTimeString()}</span> : null}
        <span>Auto-run: {isAutoRunEnabled ? "ON" : "OFF"}</span>
        {isAutoRunEnabled ? <span>Auto mode: {autoRunTargetMode}</span> : null}
        {isAutoRunEnabled && isAutoRunUsingStarterFallback ? <span>Auto mode fallback: using starter target (no selected run)</span> : null}
        {isAutoRunEnabled ? <span>Next auto-run in: {autoRunCountdownSec}s</span> : null}
        {isAutoRunEnabled ? <span>Auto effective interval: {Math.round(autoRunEffectiveIntervalMs / 1000)}s</span> : null}
        {isAutoRunEnabled ? <span>Auto target path: {resolvedAutoRunTargetPath || "(empty)"}</span> : null}
        {isAutoRunEnabled && autoRunPauseWhenHidden && typeof document !== "undefined" && document.visibilityState === "hidden" ? <span>Auto-run paused: tab hidden</span> : null}
        {isAutoRunEnabled && runsSummary.running > 0 ? <span>Auto-run waiting for active run</span> : null}
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

      {activeControlLabels.length > 0 ? (
        <section className="active-controls">
          {activeControlLabels.map((controlLabel) => (
            <span key={controlLabel}>{controlLabel}</span>
          ))}
        </section>
      ) : null}

      <section className="workspace-grid">
        <div className="runs-pane">
          <div className="pane-header">
            <h2>Runs</h2>
            <span className="pane-meta">{visibleRuns.length} visible</span>
          </div>

          {error ? <p className="error">Could not load runs: {error}</p> : null}

          {!loading && runs.length === 0 ? <p className="empty">No runs yet.</p> : null}

          {visibleRuns.length > 0 ? (
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
                        setSelectedRunId(run.runId);
                        setSelectedIssueIndex(0);
                        setSelectedSourceFilePath(null);
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
          ) : null}

          {!loading && runs.length > 0 && visibleRuns.length === 0 ? (
            <p className="empty">No runs match current status filter.</p>
          ) : null}
        </div>

        <div className="inspector-pane">
          <div className="pane-header">
            <h2>Inspector</h2>
            <span className="pane-meta">{selectedRunId ? "run selected" : "no selection"}</span>
          </div>

          {!loading && runs.length > 0 && !selectedRunId ? (
            <section className="selection-empty">
              <p>Select a run from the table to inspect details.</p>
              <button
                onClick={() => {
                  if (latestRunningRunId) {
                    setSelectedRunId(latestRunningRunId);
                  }
                }}
                disabled={!latestRunningRunId}
              >
                Jump to running
              </button>
            </section>
          ) : null}

          {selectedRunId ? (
            <section className="detail-panel">
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

              <section className="detail-block">
                <div className="detail-block-header">
                  <h3>Files</h3>
                  <button
                    onClick={() => {
                      setIsFilesSectionOpen((isOpen) => !isOpen);
                    }}
                  >
                    {isFilesSectionOpen ? "Hide" : "Show"}
                  </button>
                  <div className="detail-actions">
                    {selectedSourceFilePath ? (
                      <button
                        onClick={() => {
                          setSelectedSourceFilePath(null);
                        }}
                      >
                        Use issue context
                      </button>
                    ) : null}
                    <input
                      type="search"
                      placeholder="Filter files"
                      value={fileSearchTerm}
                      onChange={(event) => {
                        setFileSearchTerm(event.target.value);
                      }}
                    />
                  </div>
                </div>

                {isFilesSectionOpen ? (
                  <>

                {filesLoading ? <p className="empty">Loading files...</p> : null}
                {filesError ? <p className="error">Could not load files: {filesError}</p> : null}

                {!filesLoading && !filesError && visibleRunFiles.length > 0 ? (
                  <ul className="detail-list">
                    {visibleRunFiles.slice(0, 30).map((fileEntry) => (
                      <li
                        key={fileEntry.path}
                        className={selectedSourceFilePath === `${selectedRun.targetPath}/${fileEntry.path}` ? "selected-issue" : ""}
                        onClick={() => {
                          setSelectedSourceFilePath(`${selectedRun.targetPath}/${fileEntry.path}`);
                        }}
                      >
                        <span className="mono">{fileEntry.path}</span>
                        {" — "}
                        issues: {fileEntry.issueCount}
                      </li>
                    ))}
                  </ul>
                ) : null}

                {!filesLoading && !filesError && runFiles.length === 0 ? (
                  <p className="empty">No PHP files for selected run.</p>
                ) : null}

                {!filesLoading && !filesError && runFiles.length > 0 && visibleRunFiles.length === 0 ? (
                  <p className="empty">No files match current filter.</p>
                ) : null}
                  </>
                ) : null}
              </section>

              <section className="detail-block">
                <div className="detail-block-header">
                  <h3>Issues</h3>
                  <button
                    onClick={() => {
                      setIsIssuesSectionOpen((isOpen) => !isOpen);
                    }}
                  >
                    {isIssuesSectionOpen ? "Hide" : "Show"}
                  </button>
                  <div className="detail-actions">
                    <button
                      onClick={() => {
                        setIssueSearchTerm("");
                        setIssueIdentifierFilter("all");
                        setIssuePage(0);
                      }}
                      disabled={issueSearchTerm.trim().length === 0 && issueIdentifierFilter === "all"}
                    >
                      Clear issue filters
                    </button>
                    <select
                      value={issueIdentifierFilter}
                      onChange={(event) => {
                        const value = event.target.value;
                        if (value === "with" || value === "without") {
                          setIssueIdentifierFilter(value);
                          setIssuePage(0);
                          return;
                        }

                        setIssueIdentifierFilter("all");
                        setIssuePage(0);
                      }}
                    >
                      <option value="all">All identifiers</option>
                      <option value="with">With identifier</option>
                      <option value="without">Without identifier</option>
                    </select>
                    <input
                      type="search"
                      placeholder="Filter issues"
                      value={issueSearchTerm}
                      onChange={(event) => {
                        setIssueSearchTerm(event.target.value);
                        setIssuePage(0);
                      }}
                    />
                  </div>
                  {isIssuesSectionOpen && filteredIssueEntries.length > detailPageSize ? (
                    <div className="pager">
                      <button
                        onClick={() => {
                          setIssuePage((page) => Math.max(0, page - 1));
                        }}
                        disabled={issuePage === 0}
                      >
                        Prev
                      </button>
                      <span>
                        {issuePage + 1}/{Math.max(1, Math.ceil(filteredIssueEntries.length / detailPageSize))}
                      </span>
                      <button
                        onClick={() => {
                          setIssuePage((page) => {
                            const maxPage = Math.max(0, Math.ceil(filteredIssueEntries.length / detailPageSize) - 1);
                            return Math.min(maxPage, page + 1);
                          });
                        }}
                        disabled={issuePage >= Math.max(0, Math.ceil(filteredIssueEntries.length / detailPageSize) - 1)}
                      >
                        Next
                      </button>
                    </div>
                  ) : null}
                </div>

                {isIssuesSectionOpen ? (
                  filteredIssueEntries.length > 0 ? (
                    <ul className="detail-list">
                      {filteredIssueEntries
                        .slice(issuePage * detailPageSize, (issuePage + 1) * detailPageSize)
                        .map(({ issue, absoluteIndex }) => {
                          return (
                            <li
                              key={`${issue.file}-${issue.line}-${absoluteIndex}`}
                              className={absoluteIndex === selectedIssueIndex ? "selected-issue" : ""}
                              onClick={() => {
                                setSelectedIssueIndex(absoluteIndex);
                                setSelectedSourceFilePath(null);
                              }}
                            >
                              <span className="mono">{issue.file}:{issue.line}</span> — {issue.message}
                              {issue.identifier ? <span className="issue-identifier">[{issue.identifier}]</span> : null}
                            </li>
                          );
                        })}
                    </ul>
                  ) : selectedRun.issues.length > 0 ? (
                    <p className="empty">No issues match current filter.</p>
                  ) : (
                    <p className="empty">No issues in selected run.</p>
                  )
                ) : null}
              </section>

              <section className="detail-block">
                <div className="detail-block-header">
                  <h3>Source Preview</h3>
                  <button
                    onClick={() => {
                      setIsSourceSectionOpen((isOpen) => !isOpen);
                    }}
                  >
                    {isSourceSectionOpen ? "Hide" : "Show"}
                  </button>
                </div>

                {isSourceSectionOpen ? (
                  <>

                {sourceLoading ? <p className="empty">Loading source preview...</p> : null}
                {sourceError ? <p className="error">Could not load source: {sourceError}</p> : null}

                {!sourceLoading && !sourceError && sourcePayload ? (
                  <>
                    <p className="mono">{sourcePayload.file}</p>
                    <pre className="source-preview">
                      {sourcePayload.content.split("\n").map((lineContent, index) => {
                        const lineNumber = index + 1;
                        const isActiveLine = activeIssueLineInSource === lineNumber;

                        return (
                          <div key={`${lineNumber}-${lineContent}`} className={isActiveLine ? "source-line active" : "source-line"}>
                            <span className="source-line-number">{lineNumber}</span>
                            <span>{lineContent}</span>
                          </div>
                        );
                      })}
                    </pre>
                  </>
                ) : null}

                {!sourceLoading && !sourceError && !sourcePayload ? (
                  <p className="empty">Select an issue to load source preview.</p>
                ) : null}
                  </>
                ) : null}
              </section>

              <section className="detail-block">
                <div className="detail-block-header">
                  <h3>Logs</h3>
                  <button
                    onClick={() => {
                      setIsLogsSectionOpen((isOpen) => !isOpen);
                    }}
                  >
                    {isLogsSectionOpen ? "Hide" : "Show"}
                  </button>
                  <div className="detail-actions">
                    <button
                      onClick={() => {
                        setLogSearchTerm("");
                        setLogStreamFilter("all");
                        setLogPage(0);
                      }}
                      disabled={logSearchTerm.trim().length === 0 && logStreamFilter === "all"}
                    >
                      Clear log filters
                    </button>
                    <select
                      value={logStreamFilter}
                      onChange={(event) => {
                        const value = event.target.value;
                        if (value === "stdout" || value === "stderr") {
                          setLogStreamFilter(value);
                          setLogPage(0);
                          return;
                        }

                        setLogStreamFilter("all");
                        setLogPage(0);
                      }}
                    >
                      <option value="all">All streams</option>
                      <option value="stdout">stdout</option>
                      <option value="stderr">stderr</option>
                    </select>
                    <input
                      type="search"
                      placeholder="Filter logs"
                      value={logSearchTerm}
                      onChange={(event) => {
                        setLogSearchTerm(event.target.value);
                        setLogPage(0);
                      }}
                    />
                  </div>
                  {isLogsSectionOpen && filteredLogs.length > detailPageSize ? (
                    <div className="pager">
                      <button
                        onClick={() => {
                          setLogPage((page) => Math.max(0, page - 1));
                        }}
                        disabled={logPage === 0}
                      >
                        Prev
                      </button>
                      <span>
                        {logPage + 1}/{Math.max(1, Math.ceil(filteredLogs.length / detailPageSize))}
                      </span>
                      <button
                        onClick={() => {
                          setLogPage((page) => {
                            const maxPage = Math.max(0, Math.ceil(filteredLogs.length / detailPageSize) - 1);
                            return Math.min(maxPage, page + 1);
                          });
                        }}
                        disabled={logPage >= Math.max(0, Math.ceil(filteredLogs.length / detailPageSize) - 1)}
                      >
                        Next
                      </button>
                    </div>
                  ) : null}
                </div>

                {isLogsSectionOpen ? (
                  filteredLogs.length > 0 ? (
                    <ul className="detail-list">
                      {filteredLogs
                        .slice(logPage * detailPageSize, (logPage + 1) * detailPageSize)
                        .map((logEntry, index) => (
                          <li key={`${logEntry.timestamp}-${logEntry.stream}-${index}`}>
                            <span className="mono">{new Date(logEntry.timestamp).toLocaleTimeString()} [{logEntry.stream}]</span>
                            {" — "}
                            {logEntry.message.length > 200 ? `${logEntry.message.slice(0, 200)}…` : logEntry.message}
                          </li>
                        ))}
                    </ul>
                  ) : selectedRun.logs.length > 0 ? (
                    <p className="empty">No logs match current filter.</p>
                  ) : (
                    <p className="empty">No logs in selected run.</p>
                  )
                ) : null}
              </section>

              <section className="detail-block">
                <div className="detail-block-header">
                  <h3>AI Assist</h3>
                </div>

                {!activeIssue ? <p className="empty">Select an issue to load AI assistance.</p> : null}
                {activeIssue && isLlmAvailable === null ? <p className="empty">Checking AI health...</p> : null}
                {activeIssue && isLlmAvailable === false ? <p className="empty">LLM is currently unavailable.</p> : null}
                {activeIssue && isLlmAvailable === true && isAiLoading ? <p className="empty">Loading AI assistance...</p> : null}
                {activeIssue && isLlmAvailable === true && aiError ? <p className="error">Could not load AI assistance: {aiError}</p> : null}

                {activeIssue && isLlmAvailable === true && !isAiLoading && !aiError && aiExplain ? (
                  <>
                    <p className="ai-meta">
                      Explain source: {aiExplain.source} · provider: {aiExplain.provider}
                    </p>
                    {aiExplain.fallbackReason ? <p className="ai-meta">Explain fallback: {aiExplain.fallbackReason}</p> : null}
                    <p>{aiExplain.explanation}</p>
                    {aiExplain.recommendations.length > 0 ? (
                      <ul className="detail-list">
                        {aiExplain.recommendations.map((recommendation, recommendationIndex) => (
                          <li key={`${recommendation}-${recommendationIndex}`}>{recommendation}</li>
                        ))}
                      </ul>
                    ) : null}
                  </>
                ) : null}

                {activeIssue && isLlmAvailable === true && !isAiLoading && !aiError && aiSuggestFix ? (
                  <>
                    <p className="ai-meta">
                      Suggest source: {aiSuggestFix.source} · provider: {aiSuggestFix.provider}
                    </p>
                    {aiSuggestFix.fallbackReason ? <p className="ai-meta">Suggest fallback: {aiSuggestFix.fallbackReason}</p> : null}
                    <p>{aiSuggestFix.rationale}</p>
                    <pre className="source-preview ai-diff-preview">{aiSuggestFix.proposedDiff}</pre>
                  </>
                ) : null}
              </section>
            </>
          ) : null}
            </section>
          ) : null}
        </div>
      </section>
    </main>
  );
}
