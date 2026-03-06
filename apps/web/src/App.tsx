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
import { DetailPanel } from "./components/detail-panel.js";
import { useVisibleRunFiles } from "./hooks/use-visible-run-files.js";
import { useFilteredIssueEntries } from "./hooks/use-filtered-issue-entries.js";
import { useFilteredLogs } from "./hooks/use-filtered-logs.js";
import { useActiveIssueLineInSource } from "./hooks/use-active-issue-line-in-source.js";
import { useResolvedSourceFilePath } from "./hooks/use-resolved-source-file-path.js";
import { useActiveSourceSnippet } from "./hooks/use-active-source-snippet.js";
import { DashboardBrand } from "./components/dashboard-brand.js";
import { HeaderRunFilters } from "./components/header-run-filters.js";
import { HeaderToggleControls } from "./components/header-toggle-controls.js";
import { HeaderIntervalControls } from "./components/header-interval-controls.js";
import { HeaderActionButtons } from "./components/header-action-buttons.js";
import { RunsPane } from "./components/runs-pane.js";
import { CopyLinkError } from "./components/copy-link-error.js";
import { InspectorPane } from "./components/inspector-pane.js";

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

  const activeIssueLineInSource = useActiveIssueLineInSource({
    sourcePayload,
    activeIssue
  });

  const resolvedSourceFilePath = useResolvedSourceFilePath({
    selectedRunId,
    selectedRun,
    selectedSourceFilePath,
    activeIssueFile: activeIssue?.file
  });

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

  const activeSourceSnippet = useActiveSourceSnippet({
    sourcePayload,
    activeIssueLineInSource
  });

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
        <DashboardBrand />
        <div className="header-actions">
          <HeaderRunFilters
            runsStatusFilter={runsStatusFilter}
            setRunsStatusFilter={setRunsStatusFilter}
            runsSortOrder={runsSortOrder}
            setRunsSortOrder={setRunsSortOrder}
          />
          <HeaderToggleControls
            isLivePollingEnabled={isLivePollingEnabled}
            setIsLivePollingEnabled={setIsLivePollingEnabled}
            isAutoRunEnabled={isAutoRunEnabled}
            setIsAutoRunEnabled={setIsAutoRunEnabled}
            setLastAutoRunError={setLastAutoRunError}
            setAutoRunDisabledReason={setAutoRunDisabledReason}
            setAutoRunCountdownSec={setAutoRunCountdownSec}
            autoRunEffectiveIntervalMs={autoRunEffectiveIntervalMs}
            autoRunPauseWhenHidden={autoRunPauseWhenHidden}
            setAutoRunPauseWhenHidden={setAutoRunPauseWhenHidden}
          />
          <HeaderIntervalControls
            livePollingIntervalMs={livePollingIntervalMs}
            setLivePollingIntervalMs={setLivePollingIntervalMs}
            autoRunIntervalMs={autoRunIntervalMs}
            setAutoRunIntervalMs={setAutoRunIntervalMs}
            autoRunMaxFailures={autoRunMaxFailures}
            setAutoRunMaxFailures={setAutoRunMaxFailures}
            autoRunTargetMode={autoRunTargetMode}
            setAutoRunTargetMode={setAutoRunTargetMode}
          />
          <HeaderActionButtons
            startRunLoading={startRunLoading}
            resolvedAutoRunTargetPath={resolvedAutoRunTargetPath}
            startRunFromUi={startRunFromUi}
            copyCurrentDeepLink={copyCurrentDeepLink}
            copyLinkStatus={copyLinkStatus}
            resetDashboardControls={resetDashboardControls}
            autoRunTriggerCount={autoRunTriggerCount}
            setAutoRunTriggerCount={setAutoRunTriggerCount}
            autoRunFailureCount={autoRunFailureCount}
            autoRunConsecutiveFailures={autoRunConsecutiveFailures}
            lastAutoRunError={lastAutoRunError}
            setAutoRunFailureCount={setAutoRunFailureCount}
            setAutoRunConsecutiveFailures={setAutoRunConsecutiveFailures}
            setAutoRunDisabledReason={setAutoRunDisabledReason}
            setLastAutoRunError={setLastAutoRunError}
            isAutoRunEnabled={isAutoRunEnabled}
            setIsAutoRunEnabled={setIsAutoRunEnabled}
            setAutoRunCountdownSec={setAutoRunCountdownSec}
            autoRunEffectiveIntervalMs={autoRunEffectiveIntervalMs}
            lastAutoRunAt={lastAutoRunAt}
            setLastAutoRunAt={setLastAutoRunAt}
            autoRunDisabledReason={autoRunDisabledReason}
            latestRunningRunId={latestRunningRunId}
            setSelectedRunId={setSelectedRunId}
            setSelectedIssueIndex={setSelectedIssueIndex}
            setSelectedSourceFilePath={setSelectedSourceFilePath}
            selectedRunId={selectedRunId}
            refreshRuns={refreshRuns}
            loading={loading}
          />
        </div>
      </header>

      <CopyLinkError copyLinkStatus={copyLinkStatus} />

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
        <RunsPane
          visibleRuns={visibleRuns}
          selectedRunId={selectedRunId}
          onSelectRun={(runId) => {
            setSelectedRunId(runId);
            setSelectedIssueIndex(0);
            setSelectedSourceFilePath(null);
          }}
          error={error}
          loading={loading}
          runsCount={runs.length}
        />

        <InspectorPane
          selectedRunId={selectedRunId}
          loading={loading}
          runsCount={runs.length}
          latestRunningRunId={latestRunningRunId}
          onJumpToRunning={(runId) => {
            setSelectedRunId(runId);
          }}
          detailPanel={selectedRunId ? (
            <DetailPanel
              detailLoading={detailLoading}
              detailError={detailError}
              selectedRun={selectedRun}
              copyRunIdStatus={copyRunIdStatus}
              copyRunId={copyRunId}
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
              isSourceSectionOpen={isSourceSectionOpen}
              setIsSourceSectionOpen={setIsSourceSectionOpen}
              sourceLoading={sourceLoading}
              sourceError={sourceError}
              sourcePayload={sourcePayload}
              activeIssueLineInSource={activeIssueLineInSource}
              isLogsSectionOpen={isLogsSectionOpen}
              setIsLogsSectionOpen={setIsLogsSectionOpen}
              logSearchTerm={logSearchTerm}
              setLogSearchTerm={setLogSearchTerm}
              logStreamFilter={logStreamFilter}
              setLogStreamFilter={setLogStreamFilter}
              setLogPage={setLogPage}
              filteredLogs={filteredLogs}
              logPage={logPage}
              activeIssue={activeIssue}
              isLlmAvailable={isLlmAvailable}
              isAiLoading={isAiLoading}
              aiError={aiError}
              aiExplain={aiExplain}
              aiSuggestFix={aiSuggestFix}
            />
          ) : null}
        />
      </section>
    </main>
  );
}
