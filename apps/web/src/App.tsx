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
import { ActiveControls } from "./components/active-controls.js";
import { RunsSummary } from "./components/runs-summary.js";
import { RunStarter } from "./components/run-starter.js";
import { RunsTable } from "./components/runs-table.js";
import { SelectionEmpty } from "./components/selection-empty.js";
import { RunDetailMeta } from "./components/run-detail-meta.js";
import { FilesDetailBlock } from "./components/files-detail-block.js";
import { IssuesDetailBlock } from "./components/issues-detail-block.js";
import { SourceDetailBlock } from "./components/source-detail-block.js";
import { LogsDetailBlock } from "./components/logs-detail-block.js";
import { AiAssistDetailBlock } from "./components/ai-assist-detail-block.js";
import { useVisibleRunFiles } from "./hooks/use-visible-run-files.js";
import { useFilteredIssueEntries } from "./hooks/use-filtered-issue-entries.js";
import { useFilteredLogs } from "./hooks/use-filtered-logs.js";

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

  const visibleRunFiles = useVisibleRunFiles({ fileSearchTerm, runFiles });

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

  const filteredIssueEntries = useFilteredIssueEntries({
    selectedRun,
    issueSearchTerm,
    issueIdentifierFilter
  });

  const filteredLogs = useFilteredLogs({
    selectedRun,
    logSearchTerm,
    logStreamFilter
  });

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

      <RunStarter
        startRunTargetPath={startRunTargetPath}
        setStartRunTargetPath={setStartRunTargetPath}
        setStartRunError={setStartRunError}
        startRunFromUi={() => startRunFromUi()}
        starterTargetPresets={starterTargetPresets}
        selectedRun={selectedRun}
        startRunLoading={startRunLoading}
      />

      {startRunError ? <p className="error">Could not start run: {startRunError}</p> : null}

      <RunsSummary
        total={runsSummary.total}
        running={runsSummary.running}
        finished={runsSummary.finished}
        lastRefreshAt={lastRefreshAt}
        isAutoRunEnabled={isAutoRunEnabled}
        autoRunTargetMode={autoRunTargetMode}
        isAutoRunUsingStarterFallback={isAutoRunUsingStarterFallback}
        autoRunCountdownSec={autoRunCountdownSec}
        autoRunEffectiveIntervalMs={autoRunEffectiveIntervalMs}
        resolvedAutoRunTargetPath={resolvedAutoRunTargetPath}
        autoRunPauseWhenHidden={autoRunPauseWhenHidden}
        isDocumentHidden={typeof document !== "undefined" && document.visibilityState === "hidden"}
        lastAutoRunAt={lastAutoRunAt}
        lastAutoRunError={lastAutoRunError}
        isLlmAvailable={isLlmAvailable}
        activeAiProvider={activeAiProvider}
        activeAiModel={activeAiModel}
        autoRunTriggerCount={autoRunTriggerCount}
        autoRunFailureCount={autoRunFailureCount}
        autoRunConsecutiveFailures={autoRunConsecutiveFailures}
        autoRunDisabledReason={autoRunDisabledReason}
      />

      <ActiveControls labels={activeControlLabels} />

      <section className="workspace-grid">
        <div className="runs-pane">
          <div className="pane-header">
            <h2>Runs</h2>
            <span className="pane-meta">{visibleRuns.length} visible</span>
          </div>

          {error ? <p className="error">Could not load runs: {error}</p> : null}

          {!loading && runs.length === 0 ? <p className="empty">No runs yet.</p> : null}

          {visibleRuns.length > 0 ? (
            <RunsTable
              visibleRuns={visibleRuns}
              selectedRunId={selectedRunId}
              onSelectRun={(runId) => {
                setSelectedRunId(runId);
                setSelectedIssueIndex(0);
                setSelectedSourceFilePath(null);
              }}
            />
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
            <SelectionEmpty
              latestRunningRunId={latestRunningRunId}
              onJumpToRunning={(runId) => {
                setSelectedRunId(runId);
              }}
            />
          ) : null}

          {selectedRunId ? (
            <section className="detail-panel">
          <RunDetailMeta
            detailLoading={detailLoading}
            detailError={detailError}
            selectedRun={selectedRun}
            copyRunIdStatus={copyRunIdStatus}
            copyRunId={copyRunId}
          />

          {!detailLoading && !detailError && selectedRun ? (
            <>
              <FilesDetailBlock
                isFilesSectionOpen={isFilesSectionOpen}
                setIsFilesSectionOpen={setIsFilesSectionOpen}
                selectedSourceFilePath={selectedSourceFilePath}
                setSelectedSourceFilePath={setSelectedSourceFilePath}
                fileSearchTerm={fileSearchTerm}
                setFileSearchTerm={setFileSearchTerm}
                filesLoading={filesLoading}
                filesError={filesError}
                visibleRunFiles={visibleRunFiles}
                runFiles={runFiles}
                selectedRun={selectedRun}
              />

              <IssuesDetailBlock
                isIssuesSectionOpen={isIssuesSectionOpen}
                setIsIssuesSectionOpen={setIsIssuesSectionOpen}
                issueSearchTerm={issueSearchTerm}
                setIssueSearchTerm={setIssueSearchTerm}
                issueIdentifierFilter={issueIdentifierFilter}
                setIssueIdentifierFilter={setIssueIdentifierFilter}
                setIssuePage={setIssuePage}
                filteredIssueEntries={filteredIssueEntries}
                issuePage={issuePage}
                detailPageSize={detailPageSize}
                selectedIssueIndex={selectedIssueIndex}
                setSelectedIssueIndex={setSelectedIssueIndex}
                setSelectedSourceFilePath={setSelectedSourceFilePath}
                selectedRun={selectedRun}
              />

              <SourceDetailBlock
                isSourceSectionOpen={isSourceSectionOpen}
                setIsSourceSectionOpen={setIsSourceSectionOpen}
                sourceLoading={sourceLoading}
                sourceError={sourceError}
                sourcePayload={sourcePayload}
                activeIssueLineInSource={activeIssueLineInSource}
              />

              <LogsDetailBlock
                isLogsSectionOpen={isLogsSectionOpen}
                setIsLogsSectionOpen={setIsLogsSectionOpen}
                logSearchTerm={logSearchTerm}
                setLogSearchTerm={setLogSearchTerm}
                logStreamFilter={logStreamFilter}
                setLogStreamFilter={setLogStreamFilter}
                setLogPage={setLogPage}
                filteredLogs={filteredLogs}
                logPage={logPage}
                detailPageSize={detailPageSize}
                selectedRun={selectedRun}
              />

              <AiAssistDetailBlock
                activeIssue={activeIssue}
                isLlmAvailable={isLlmAvailable}
                isAiLoading={isAiLoading}
                aiError={aiError}
                aiExplain={aiExplain}
                aiSuggestFix={aiSuggestFix}
              />
            </>
          ) : null}
            </section>
          ) : null}
        </div>
      </section>
    </main>
  );
}
