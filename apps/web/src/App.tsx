import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ViewMode } from "./types.js";
import { FooterBar } from "./components/footer-bar.js";
import { MainPanel } from "./components/main-panel.js";
import { Sidepanel } from "./components/sidepanel.js";
import { Topbar } from "./components/topbar.js";
import { useAiAssistance } from "./hooks/use-ai-assistance.js";
import { useFileTreeState } from "./hooks/use-file-tree-state.js";
import { useAutoSelectIssueInFile, useIssueNavigation } from "./hooks/use-issue-navigation.js";
import { useKeyboardIssueNavigation } from "./hooks/use-keyboard-issue-navigation.js";
import { useRunViewModel } from "./hooks/use-run-view-model.js";
import { useRunsRuntime } from "./hooks/use-runs-runtime.js";
import { useRunSource } from "./hooks/use-run-source.js";
import { useSidepanelResize } from "./hooks/use-sidepanel-resize.js";
import { useUrlUiSync } from "./hooks/use-url-ui-sync.js";
import { loadSidepanelWidth } from "./utils/sidepanel-width.js";
import { getIssueKey } from "./utils/app-helpers.js";
import { parseUiStateFromUrl } from "./utils/url-ui-state.js";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8080";

const SIDEPANEL_DEFAULT_WIDTH = 420;
const SIDEPANEL_MIN_WIDTH = 280;
const SIDEPANEL_MAX_WIDTH = 720;
const RUN_TARGET_DEFAULT_PATH = "/workspace/examples/php-sample";
const AI_HEALTH_FAILURE_THRESHOLD = 2;

export function App() {
  const initialUrlState = parseUiStateFromUrl();
  const [selectedIssueIndex, setSelectedIssueIndex] = useState(initialUrlState.issueIndex);
  const [collapsedDirectories, setCollapsedDirectories] = useState<Set<string>>(new Set());
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>(initialUrlState.viewMode);
  const [sidepanelWidth, setSidepanelWidth] = useState<number>(() => loadSidepanelWidth(SIDEPANEL_DEFAULT_WIDTH, SIDEPANEL_MIN_WIDTH, SIDEPANEL_MAX_WIDTH));
  const [isResizingSidepanel, setIsResizingSidepanel] = useState(false);
  const selectedIssueKeyRef = useRef<string | null>(null);
  const layoutRef = useRef<HTMLDivElement | null>(null);
  const handleRunSelectionCleared = useCallback(() => {
    setSelectedFilePath(null);
  }, []);

  const {
    runs,
    selectedRunId,
    setSelectedRunId,
    selectedRun,
    runFiles,
    isRunDetailLoading,
    loading,
    error,
    isLlmAvailable,
    activeAiProvider,
    activeAiModel,
    handleStartRun
  } = useRunsRuntime({
    apiBase: API_BASE,
    initialRunId: initialUrlState.runId,
    runTargetDefaultPath: RUN_TARGET_DEFAULT_PATH,
    aiHealthFailureThreshold: AI_HEALTH_FAILURE_THRESHOLD,
    selectedIssueKeyRef,
    setSelectedIssueIndex,
    onRunSelectionCleared: handleRunSelectionCleared
  });

  const hasRuns = runs.length > 0;
  const hasSelectedRun = selectedRun !== null;
  const {
    issues,
    safeIssueIndex,
    activeIssue,
    hasIssues,
    resolvedRunId,
    activeIssueRelativePath,
    activeIssueForViewer,
    activeIssueIndexForViewer,
    aiContextIssue,
    fileIssuesForViewer,
    absoluteSourceFilePath,
    identifiers
  } = useRunViewModel({
    selectedRun,
    selectedIssueIndex,
    selectedFilePath,
    viewMode
  });

  useEffect(() => {
    if (!activeIssue) {
      selectedIssueKeyRef.current = null;
      return;
    }

    const nextIssueKey = getIssueKey(activeIssue);
    selectedIssueKeyRef.current = nextIssueKey;
  }, [activeIssue?.file, activeIssue?.line, activeIssue?.message]);

  const {
    activeSourceContent,
    activeSourceError
  } = useRunSource({
    apiBase: API_BASE,
    resolvedRunId,
    absoluteFilePath: absoluteSourceFilePath
  });
  const activeSourceSnippet = useMemo(() => {
    if (!activeIssueForViewer || !activeSourceContent) {
      return undefined;
    }

    return activeSourceContent.split(/\r?\n/)[activeIssueForViewer.line - 1]?.trim() || undefined;
  }, [activeIssueForViewer, activeSourceContent]);
  const {
    aiExplain,
    aiSuggestFix,
    isAiLoading,
    aiError
  } = useAiAssistance({
    apiBase: API_BASE,
    isLlmAvailable,
    aiContextIssue,
    activeSourceSnippet
  });

  useUrlUiSync({
    selectedRunId,
    safeIssueIndex,
    viewMode,
    hasIssues,
    onSetSelectedRunId: setSelectedRunId,
    onSetSelectedIssueIndex: setSelectedIssueIndex,
    onSetViewMode: setViewMode
  });

  useSidepanelResize({
    layoutRef,
    isResizing: isResizingSidepanel,
    sidepanelWidth,
    minWidth: SIDEPANEL_MIN_WIDTH,
    maxWidth: SIDEPANEL_MAX_WIDTH,
    onSetWidth: setSidepanelWidth,
    onStopResizing: () => setIsResizingSidepanel(false)
  });

  const {
    visibleFileTreeRows,
    currentFilePosition,
    handleToggleDirectory
  } = useFileTreeState({
    selectedRun,
    selectedRunId,
    runFiles,
    selectedFilePath,
    activeIssueRelativePath,
    collapsedDirectories,
    onSetSelectedFilePath: setSelectedFilePath,
    onSetCollapsedDirectories: setCollapsedDirectories
  });

  const {
    selectIssueByIndex,
    handleSelectFile,
    handleSelectIssueInFile
  } = useIssueNavigation({
    issues,
    selectedRunTargetPath: selectedRun?.targetPath ?? null,
    selectedIssueKeyRef,
    setSelectedIssueIndex,
    setSelectedFilePath
  });

  useAutoSelectIssueInFile({
    selectedFilePath,
    fileIssuesForViewer,
    hasActiveIssueForViewer: Boolean(activeIssueForViewer),
    onSelectIssueByIndex: selectIssueByIndex
  });

  useKeyboardIssueNavigation({
    viewMode,
    issuesLength: issues.length,
    safeIssueIndex,
    onSelectIssueByIndex: selectIssueByIndex
  });

  return (
    <div className="app">
      <Topbar
        issuesCount={issues.length}
        isLlmAvailable={isLlmAvailable}
        activeAiProvider={activeAiProvider}
        activeAiModel={activeAiModel}
        isRunDetailLoading={isRunDetailLoading}
        viewMode={viewMode}
        loading={loading}
        onChangeViewMode={setViewMode}
        onRun={() => {
          void handleStartRun();
        }}
      />

      <div className={`layout ${isResizingSidepanel ? "is-resizing" : ""}`} ref={layoutRef}>
        <Sidepanel
          width={sidepanelWidth}
          projectPath={selectedRun?.targetPath ?? ""}
          runs={runs}
          selectedRunId={selectedRunId}
          visibleFileTreeRows={visibleFileTreeRows}
          collapsedDirectories={collapsedDirectories}
          selectedFilePath={selectedFilePath}
          onSelectRun={(runId) => setSelectedRunId(runId)}
          onToggleDirectory={handleToggleDirectory}
          onSelectFile={handleSelectFile}
        />

        <div
          className="sidepanel-resizer"
          role="separator"
          aria-label="Resize runs panel"
          aria-orientation="vertical"
          onMouseDown={() => setIsResizingSidepanel(true)}
        />

        <MainPanel
          hasSelectedRun={hasSelectedRun}
          hasRuns={hasRuns}
          hasIssues={hasIssues}
          viewMode={viewMode}
          safeIssueIndex={safeIssueIndex}
          issuesLength={issues.length}
          selectedFilePath={selectedFilePath}
          selectedRun={selectedRun}
          runFilesLength={runFiles.length}
          currentFilePosition={currentFilePosition}
          error={error}
          activeSourceError={activeSourceError}
          activeIssue={activeIssue}
          activeIssueForViewer={activeIssueForViewer}
          activeIssueIndexForViewer={activeIssueIndexForViewer}
          fileIssuesForViewer={fileIssuesForViewer}
          activeSourceContent={activeSourceContent}
          identifiers={identifiers}
          aiExplain={aiExplain}
          aiSuggestFix={aiSuggestFix}
          isAiLoading={isAiLoading}
          aiError={aiError}
          onPrevIssue={() => selectIssueByIndex(safeIssueIndex - 1)}
          onNextIssue={() => selectIssueByIndex(safeIssueIndex + 1)}
          onSelectIssueInFile={handleSelectIssueInFile}
        />
      </div>

      <FooterBar
        targetPath={selectedRun?.targetPath ?? "-"}
        runId={selectedRun?.runId?.slice(0, 8) ?? "-"}
        status={selectedRun?.status === "finished" ? "Analysis Complete" : selectedRun?.status ?? "idle"}
        issuesCount={issues.length}
        runsCount={runs.length}
      />
    </div>
  );
}

