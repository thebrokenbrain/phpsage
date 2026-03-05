import { useEffect, useMemo, useState } from "react";

interface RunSummary {
  runId: string;
  targetPath: string;
  status: "running" | "finished";
  createdAt: string;
  updatedAt: string;
  exitCode: number | null;
  issueCount: number;
}

interface RunIssue {
  file: string;
  line: number;
  message: string;
  identifier?: string;
}

interface RunLogEntry {
  timestamp: string;
  stream: "stdout" | "stderr";
  message: string;
}

interface RunRecord extends RunSummary {
  logs: RunLogEntry[];
  issues: RunIssue[];
}

interface RunFileItem {
  path: string;
  issueCount: number;
  hasIssues: boolean;
}

interface RunFilesPayload {
  targetPath: string;
  files: RunFileItem[];
}

interface SourcePayload {
  file: string;
  content: string;
}

interface StartRunPayload {
  runId: string;
  targetPath: string;
  status: "running" | "finished";
  createdAt: string;
  updatedAt: string;
  exitCode: number | null;
  issueCount: number;
}

const defaultApiBaseUrl = "http://localhost:8080";
const detailPageSize = 10;
const defaultRunningPollIntervalMs = 2000;
const starterTargetStorageKey = "phpsage.runStarter.targetPath";
const starterTargetPresets = ["/workspace/examples/php-sample", "/workspace/examples/php-sample-ok"];

function readInitialQuerySelection(): {
  runId: string | null;
  file: string | null;
  issueIndex: number | null;
  logPage: number | null;
  runsStatusFilter: "all" | "running" | "finished";
  runsSortOrder: "updatedDesc" | "updatedAsc";
  fileSearchTerm: string;
  issueSearchTerm: string;
  issueIdentifierFilter: "all" | "with" | "without";
  logSearchTerm: string;
  logStreamFilter: "all" | "stdout" | "stderr";
  isFilesSectionOpen: boolean;
  isIssuesSectionOpen: boolean;
  isSourceSectionOpen: boolean;
  isLogsSectionOpen: boolean;
  startTargetPath: string | null;
  isLivePollingEnabled: boolean;
  livePollingIntervalMs: number | null;
} {
  if (typeof window === "undefined") {
    return {
      runId: null,
      file: null,
      issueIndex: null,
      logPage: null,
      runsStatusFilter: "all",
      runsSortOrder: "updatedDesc",
      fileSearchTerm: "",
      issueSearchTerm: "",
      issueIdentifierFilter: "all",
      logSearchTerm: "",
      logStreamFilter: "all",
      isFilesSectionOpen: true,
      isIssuesSectionOpen: true,
      isSourceSectionOpen: true,
      isLogsSectionOpen: true,
      startTargetPath: null,
      isLivePollingEnabled: true,
      livePollingIntervalMs: null
    };
  }

  const searchParams = new URLSearchParams(window.location.search);
  const runId = searchParams.get("runId");
  const file = searchParams.get("file");
  const issue = searchParams.get("issue");
  const logPage = searchParams.get("logPage");
  const status = searchParams.get("status");
  const sort = searchParams.get("sort");
  const fileQuery = searchParams.get("fileQuery");
  const issueQuery = searchParams.get("issueQuery");
  const issueIdentifier = searchParams.get("issueIdentifier");
  const logQuery = searchParams.get("logQuery");
  const logStream = searchParams.get("logStream");
  const filesOpen = searchParams.get("filesOpen");
  const issuesOpen = searchParams.get("issuesOpen");
  const sourceOpen = searchParams.get("sourceOpen");
  const logsOpen = searchParams.get("logsOpen");
  const target = searchParams.get("target");
  const live = searchParams.get("live");
  const interval = searchParams.get("interval");
  const parsedIssueIndex = issue ? Number.parseInt(issue, 10) : Number.NaN;
  const parsedLogPage = logPage ? Number.parseInt(logPage, 10) : Number.NaN;
  const parsedInterval = interval ? Number.parseInt(interval, 10) : Number.NaN;

  return {
    runId: runId && runId.trim().length > 0 ? runId : null,
    file: file && file.trim().length > 0 ? file : null,
    issueIndex: Number.isFinite(parsedIssueIndex) && parsedIssueIndex >= 0 ? parsedIssueIndex : null,
    logPage: Number.isFinite(parsedLogPage) && parsedLogPage >= 0 ? parsedLogPage : null,
    runsStatusFilter: status === "running" || status === "finished" ? status : "all",
    runsSortOrder: sort === "updatedAsc" ? "updatedAsc" : "updatedDesc",
    fileSearchTerm: fileQuery ?? "",
    issueSearchTerm: issueQuery ?? "",
    issueIdentifierFilter: issueIdentifier === "with" || issueIdentifier === "without" ? issueIdentifier : "all",
    logSearchTerm: logQuery ?? "",
    logStreamFilter: logStream === "stdout" || logStream === "stderr" ? logStream : "all",
    isFilesSectionOpen: filesOpen !== "0",
    isIssuesSectionOpen: issuesOpen !== "0",
    isSourceSectionOpen: sourceOpen !== "0",
    isLogsSectionOpen: logsOpen !== "0",
    startTargetPath: target && target.trim().length > 0 ? target : null,
    isLivePollingEnabled: live !== "0",
    livePollingIntervalMs: Number.isFinite(parsedInterval) && parsedInterval > 0 ? parsedInterval : null
  };
}

export function App(): JSX.Element {
  const initialSelection = useMemo(() => readInitialQuerySelection(), []);
  const apiBaseUrl = useMemo(() => {
    const value = import.meta.env.VITE_API_BASE_URL as string | undefined;
    return value && value.trim().length > 0 ? value : defaultApiBaseUrl;
  }, []);

  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [runsStatusFilter, setRunsStatusFilter] = useState<"all" | "running" | "finished">(initialSelection.runsStatusFilter);
  const [runsSortOrder, setRunsSortOrder] = useState<"updatedDesc" | "updatedAsc">(initialSelection.runsSortOrder);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshAt, setLastRefreshAt] = useState<string | null>(null);
  const [isLivePollingEnabled, setIsLivePollingEnabled] = useState(initialSelection.isLivePollingEnabled);
  const [livePollingIntervalMs, setLivePollingIntervalMs] = useState(initialSelection.livePollingIntervalMs ?? defaultRunningPollIntervalMs);
  const [startRunTargetPath, setStartRunTargetPath] = useState(initialSelection.startTargetPath ?? "/workspace/examples/php-sample");
  const [startRunLoading, setStartRunLoading] = useState(false);
  const [startRunError, setStartRunError] = useState<string | null>(null);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(initialSelection.runId);
  const [selectedRun, setSelectedRun] = useState<RunRecord | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
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
  const [runFiles, setRunFiles] = useState<RunFileItem[]>([]);
  const [fileSearchTerm, setFileSearchTerm] = useState(initialSelection.fileSearchTerm);
  const [filesLoading, setFilesLoading] = useState(false);
  const [filesError, setFilesError] = useState<string | null>(null);
  const [selectedSourceFilePath, setSelectedSourceFilePath] = useState<string | null>(initialSelection.file);
  const [sourceLoading, setSourceLoading] = useState(false);
  const [isSourceSectionOpen, setIsSourceSectionOpen] = useState(initialSelection.isSourceSectionOpen);
  const [sourceError, setSourceError] = useState<string | null>(null);
  const [sourcePayload, setSourcePayload] = useState<SourcePayload | null>(null);
  const [copyLinkStatus, setCopyLinkStatus] = useState<"idle" | "copied" | "error">("idle");
  const [copyRunIdStatus, setCopyRunIdStatus] = useState<"idle" | "copied" | "error">("idle");

  const filteredRuns = useMemo(() => {
    if (runsStatusFilter === "all") {
      return runs;
    }

    return runs.filter((run) => run.status === runsStatusFilter);
  }, [runs, runsStatusFilter]);

  const visibleRuns = useMemo(() => {
    const sortedRuns = [...filteredRuns];
    sortedRuns.sort((leftRun, rightRun) => {
      const leftTimestamp = new Date(leftRun.updatedAt).getTime();
      const rightTimestamp = new Date(rightRun.updatedAt).getTime();

      if (runsSortOrder === "updatedAsc") {
        return leftTimestamp - rightTimestamp;
      }

      return rightTimestamp - leftTimestamp;
    });

    return sortedRuns;
  }, [filteredRuns, runsSortOrder]);

  const runsSummary = useMemo(() => {
    const runningCount = runs.filter((run) => run.status === "running").length;
    return {
      total: runs.length,
      running: runningCount,
      finished: runs.length - runningCount
    };
  }, [runs]);

  const activeControlLabels = useMemo(() => {
    const labels: string[] = [];

    if (runsStatusFilter !== "all") {
      labels.push(`status:${runsStatusFilter}`);
    }

    if (runsSortOrder !== "updatedDesc") {
      labels.push(`sort:${runsSortOrder}`);
    }

    if (fileSearchTerm.trim().length > 0) {
      labels.push("fileQuery");
    }

    if (issueSearchTerm.trim().length > 0) {
      labels.push("issueQuery");
    }

    if (issueIdentifierFilter !== "all") {
      labels.push(`issueIdentifier:${issueIdentifierFilter}`);
    }

    if (logSearchTerm.trim().length > 0) {
      labels.push("logQuery");
    }

    if (logStreamFilter !== "all") {
      labels.push(`logStream:${logStreamFilter}`);
    }

    if (!isLivePollingEnabled) {
      labels.push("live:off");
    }

    if (livePollingIntervalMs !== defaultRunningPollIntervalMs) {
      labels.push(`interval:${livePollingIntervalMs}`);
    }

    return labels;
  }, [
    fileSearchTerm,
    isLivePollingEnabled,
    issueIdentifierFilter,
    issueSearchTerm,
    livePollingIntervalMs,
    logSearchTerm,
    logStreamFilter,
    runsSortOrder,
    runsStatusFilter
  ]);

  const latestRunningRunId = useMemo(() => {
    const runningRuns = runs.filter((run) => run.status === "running");
    if (runningRuns.length === 0) {
      return null;
    }

    const sortedRunningRuns = [...runningRuns].sort(
      (leftRun, rightRun) => new Date(rightRun.updatedAt).getTime() - new Date(leftRun.updatedAt).getTime()
    );

    return sortedRunningRuns[0]?.runId ?? null;
  }, [runs]);

  const visibleRunFiles = useMemo(() => {
    const normalizedTerm = fileSearchTerm.trim().toLowerCase();
    if (normalizedTerm.length === 0) {
      return runFiles;
    }

    return runFiles.filter((fileEntry) => fileEntry.path.toLowerCase().includes(normalizedTerm));
  }, [fileSearchTerm, runFiles]);

  const activeIssueLineInSource = useMemo(() => {
    if (!selectedRun || !sourcePayload || selectedRun.issues.length === 0) {
      return null;
    }

    const safeIssueIndex = Math.min(selectedIssueIndex, selectedRun.issues.length - 1);
    const issue = selectedRun.issues[safeIssueIndex];
    if (!issue || issue.file !== sourcePayload.file) {
      return null;
    }

    return issue.line;
  }, [selectedIssueIndex, selectedRun, sourcePayload]);

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

  async function loadRuns(): Promise<void> {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${apiBaseUrl}/api/runs`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const payload = (await response.json()) as RunSummary[];
      setRuns(payload);
      setLastRefreshAt(new Date().toISOString());

      const fallbackRun =
        payload.find((run) => run.status === "running")
        ?? payload[0];

      if (payload.length === 0) {
        setSelectedRunId(null);
        setSelectedRun(null);
        return;
      }

      setSelectedRunId((currentSelectedRunId) => {
        if (!currentSelectedRunId) {
          return fallbackRun.runId;
        }

        const stillExists = payload.some((run) => run.runId === currentSelectedRunId);
        return stillExists ? currentSelectedRunId : fallbackRun.runId;
      });
    } catch (fetchError) {
      const message = fetchError instanceof Error ? fetchError.message : String(fetchError);
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  async function startRunFromUi(): Promise<void> {
    const normalizedTargetPath = startRunTargetPath.trim();
    if (normalizedTargetPath.length === 0) {
      setStartRunError("Target path is required.");
      return;
    }

    setStartRunLoading(true);
    setStartRunError(null);

    try {
      const response = await fetch(`${apiBaseUrl}/api/runs/start`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          targetPath: normalizedTargetPath,
          execute: true
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const payload = (await response.json()) as StartRunPayload;
      setSelectedRunId(payload.runId);
      await loadRuns();
    } catch (startError) {
      const message = startError instanceof Error ? startError.message : String(startError);
      setStartRunError(message);
    } finally {
      setStartRunLoading(false);
    }
  }

  async function copyCurrentDeepLink(): Promise<void> {
    if (typeof window === "undefined" || !window.navigator.clipboard) {
      setCopyLinkStatus("error");
      return;
    }

    try {
      await window.navigator.clipboard.writeText(window.location.href);
      setCopyLinkStatus("copied");
      window.setTimeout(() => {
        setCopyLinkStatus("idle");
      }, 1500);
    } catch {
      setCopyLinkStatus("error");
    }
  }

  async function copyRunId(): Promise<void> {
    if (typeof window === "undefined" || !window.navigator.clipboard || !selectedRun) {
      setCopyRunIdStatus("error");
      return;
    }

    try {
      await window.navigator.clipboard.writeText(selectedRun.runId);
      setCopyRunIdStatus("copied");
      window.setTimeout(() => {
        setCopyRunIdStatus("idle");
      }, 1500);
    } catch {
      setCopyRunIdStatus("error");
    }
  }

  function resetDashboardControls(): void {
    setRunsStatusFilter("all");
    setRunsSortOrder("updatedDesc");
    setIssueSearchTerm("");
    setIssueIdentifierFilter("all");
    setLogSearchTerm("");
    setLogStreamFilter("all");
    setFileSearchTerm("");
    setIsLivePollingEnabled(true);
    setLivePollingIntervalMs(defaultRunningPollIntervalMs);
    setIsFilesSectionOpen(true);
    setIsIssuesSectionOpen(true);
    setIsSourceSectionOpen(true);
    setIsLogsSectionOpen(true);
  }

  useEffect(() => {
    void loadRuns();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (initialSelection.startTargetPath) {
      return;
    }

    const storedTargetPath = window.localStorage.getItem(starterTargetStorageKey);
    if (storedTargetPath && storedTargetPath.trim().length > 0) {
      setStartRunTargetPath(storedTargetPath);
    }
  }, [initialSelection.startTargetPath]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(starterTargetStorageKey, startRunTargetPath);
  }, [startRunTargetPath]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    function handlePopState(): void {
      const selection = readInitialQuerySelection();
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
      setStartRunTargetPath(selection.startTargetPath ?? "/workspace/examples/php-sample");
      setIsLivePollingEnabled(selection.isLivePollingEnabled);
      setLivePollingIntervalMs(selection.livePollingIntervalMs ?? defaultRunningPollIntervalMs);
    }

    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const url = new URL(window.location.href);

    if (selectedRunId) {
      url.searchParams.set("runId", selectedRunId);
    } else {
      url.searchParams.delete("runId");
    }

    if (runsStatusFilter === "all") {
      url.searchParams.delete("status");
    } else {
      url.searchParams.set("status", runsStatusFilter);
    }

    if (runsSortOrder === "updatedDesc") {
      url.searchParams.delete("sort");
    } else {
      url.searchParams.set("sort", runsSortOrder);
    }

    if (fileSearchTerm.trim().length > 0) {
      url.searchParams.set("fileQuery", fileSearchTerm);
    } else {
      url.searchParams.delete("fileQuery");
    }

    if (issueSearchTerm.trim().length > 0) {
      url.searchParams.set("issueQuery", issueSearchTerm);
    } else {
      url.searchParams.delete("issueQuery");
    }

    if (issueIdentifierFilter === "all") {
      url.searchParams.delete("issueIdentifier");
    } else {
      url.searchParams.set("issueIdentifier", issueIdentifierFilter);
    }

    if (logSearchTerm.trim().length > 0) {
      url.searchParams.set("logQuery", logSearchTerm);
    } else {
      url.searchParams.delete("logQuery");
    }

    if (logStreamFilter === "all") {
      url.searchParams.delete("logStream");
    } else {
      url.searchParams.set("logStream", logStreamFilter);
    }

    if (isFilesSectionOpen) {
      url.searchParams.delete("filesOpen");
    } else {
      url.searchParams.set("filesOpen", "0");
    }

    if (isIssuesSectionOpen) {
      url.searchParams.delete("issuesOpen");
    } else {
      url.searchParams.set("issuesOpen", "0");
    }

    if (isSourceSectionOpen) {
      url.searchParams.delete("sourceOpen");
    } else {
      url.searchParams.set("sourceOpen", "0");
    }

    if (isLogsSectionOpen) {
      url.searchParams.delete("logsOpen");
    } else {
      url.searchParams.set("logsOpen", "0");
    }

    if (startRunTargetPath.trim().length > 0) {
      url.searchParams.set("target", startRunTargetPath);
    } else {
      url.searchParams.delete("target");
    }

    if (isLivePollingEnabled) {
      url.searchParams.delete("live");
    } else {
      url.searchParams.set("live", "0");
    }

    if (livePollingIntervalMs === defaultRunningPollIntervalMs) {
      url.searchParams.delete("interval");
    } else {
      url.searchParams.set("interval", String(livePollingIntervalMs));
    }

    if (selectedSourceFilePath) {
      url.searchParams.set("file", selectedSourceFilePath);
    } else {
      url.searchParams.delete("file");
    }

    if (selectedRun && selectedRun.issues.length > 0) {
      url.searchParams.set("issue", String(selectedIssueIndex));
    } else {
      url.searchParams.delete("issue");
    }

    if (selectedRun && selectedRun.logs.length > 0 && logPage > 0) {
      url.searchParams.set("logPage", String(logPage));
    } else {
      url.searchParams.delete("logPage");
    }

    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
  }, [fileSearchTerm, isFilesSectionOpen, isIssuesSectionOpen, isLivePollingEnabled, isLogsSectionOpen, isSourceSectionOpen, issueIdentifierFilter, issueSearchTerm, livePollingIntervalMs, logPage, logSearchTerm, logStreamFilter, runsSortOrder, runsStatusFilter, selectedIssueIndex, selectedRun, selectedRunId, selectedSourceFilePath, startRunTargetPath]);

  useEffect(() => {
    async function loadRunDetail(runId: string): Promise<void> {
      setDetailLoading(true);
      setDetailError(null);

      try {
        const response = await fetch(`${apiBaseUrl}/api/runs/${runId}`);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const payload = (await response.json()) as RunRecord;
        setSelectedRun(payload);
        setSelectedSourceFilePath((currentPath) => {
          if (!currentPath) {
            return null;
          }

          return currentPath.startsWith(`${payload.targetPath}/`) ? currentPath : null;
        });
      } catch (fetchError) {
        const message = fetchError instanceof Error ? fetchError.message : String(fetchError);
        setDetailError(message);
        setSelectedRun(null);
      } finally {
        setDetailLoading(false);
      }
    }

    if (!selectedRunId) {
      setSelectedRun(null);
      setDetailLoading(false);
      setDetailError(null);
      return;
    }

    void loadRunDetail(selectedRunId);
  }, [apiBaseUrl, selectedRunId]);

  useEffect(() => {
    async function pollRunningRun(runId: string): Promise<void> {
      try {
        const [runsResponse, detailResponse, filesResponse] = await Promise.all([
          fetch(`${apiBaseUrl}/api/runs`),
          fetch(`${apiBaseUrl}/api/runs/${runId}`),
          fetch(`${apiBaseUrl}/api/runs/${runId}/files`)
        ]);

        if (!runsResponse.ok) {
          throw new Error(`HTTP ${runsResponse.status}`);
        }

        if (!detailResponse.ok) {
          throw new Error(`HTTP ${detailResponse.status}`);
        }

        if (!filesResponse.ok) {
          throw new Error(`HTTP ${filesResponse.status}`);
        }

        const runsPayload = (await runsResponse.json()) as RunSummary[];
        const detailPayload = (await detailResponse.json()) as RunRecord;
        const filesPayload = (await filesResponse.json()) as RunFilesPayload;

        setRuns(runsPayload);
        setSelectedRun(detailPayload);
        setRunFiles(filesPayload.files);
        setLastRefreshAt(new Date().toISOString());
        setFilesError(null);
        setDetailError(null);
        setSelectedSourceFilePath((currentPath) => {
          if (!currentPath) {
            return null;
          }

          return currentPath.startsWith(`${detailPayload.targetPath}/`) ? currentPath : null;
        });
      } catch (pollError) {
        const message = pollError instanceof Error ? pollError.message : String(pollError);
        setDetailError(message);
      }
    }

    if (!isLivePollingEnabled || !selectedRunId || !selectedRun || selectedRun.status !== "running") {
      return;
    }

    const intervalId = window.setInterval(() => {
      void pollRunningRun(selectedRunId);
    }, livePollingIntervalMs);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [apiBaseUrl, isLivePollingEnabled, livePollingIntervalMs, selectedRun, selectedRunId]);

  useEffect(() => {
    if (!selectedRun) {
      setIssuePage(0);
      return;
    }

    if (selectedRun.issues.length === 0) {
      setSelectedIssueIndex(0);
      setIssuePage(0);
      return;
    }

    const clampedIssueIndex = Math.min(Math.max(0, selectedIssueIndex), selectedRun.issues.length - 1);
    if (clampedIssueIndex !== selectedIssueIndex) {
      setSelectedIssueIndex(clampedIssueIndex);
      return;
    }

    const derivedIssuePage = Math.floor(clampedIssueIndex / detailPageSize);
    if (derivedIssuePage !== issuePage) {
      setIssuePage(derivedIssuePage);
    }
  }, [issuePage, selectedIssueIndex, selectedRun]);

  useEffect(() => {
    const maxIssuePage = Math.max(0, Math.ceil(filteredIssueEntries.length / detailPageSize) - 1);
    if (issuePage > maxIssuePage) {
      setIssuePage(maxIssuePage);
    }
  }, [filteredIssueEntries.length, issuePage]);

  useEffect(() => {
    if (filteredLogs.length === 0) {
      if (logPage !== 0) {
        setLogPage(0);
      }
      return;
    }

    const maxLogPage = Math.max(0, Math.ceil(filteredLogs.length / detailPageSize) - 1);
    const clampedLogPage = Math.min(Math.max(0, logPage), maxLogPage);
    if (clampedLogPage !== logPage) {
      setLogPage(clampedLogPage);
    }
  }, [filteredLogs.length, logPage]);

  useEffect(() => {
    async function loadRunFiles(runId: string): Promise<void> {
      setFilesLoading(true);
      setFilesError(null);

      try {
        const response = await fetch(`${apiBaseUrl}/api/runs/${runId}/files`);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const payload = (await response.json()) as RunFilesPayload;
        setRunFiles(payload.files);
      } catch (fetchError) {
        const message = fetchError instanceof Error ? fetchError.message : String(fetchError);
        setFilesError(message);
        setRunFiles([]);
      } finally {
        setFilesLoading(false);
      }
    }

    if (!selectedRunId) {
      setRunFiles([]);
      setFilesError(null);
      setFilesLoading(false);
      return;
    }

    void loadRunFiles(selectedRunId);
  }, [apiBaseUrl, selectedRunId]);

  useEffect(() => {
    async function loadSource(runId: string, filePath: string): Promise<void> {
      setSourceLoading(true);
      setSourceError(null);

      try {
        const endpoint = `${apiBaseUrl}/api/runs/${runId}/source?file=${encodeURIComponent(filePath)}`;
        const response = await fetch(endpoint);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const payload = (await response.json()) as SourcePayload;
        setSourcePayload(payload);
      } catch (fetchError) {
        const message = fetchError instanceof Error ? fetchError.message : String(fetchError);
        setSourceError(message);
        setSourcePayload(null);
      } finally {
        setSourceLoading(false);
      }
    }

    if (!selectedRunId || !selectedRun) {
      setSourceLoading(false);
      setSourceError(null);
      setSourcePayload(null);
      return;
    }

    if (selectedSourceFilePath) {
      void loadSource(selectedRunId, selectedSourceFilePath);
      return;
    }

    if (selectedRun.issues.length === 0) {
      setSourceLoading(false);
      setSourceError(null);
      setSourcePayload(null);
      return;
    }

    const safeIssueIndex = Math.min(selectedIssueIndex, selectedRun.issues.length - 1);
    const issue = selectedRun.issues[safeIssueIndex];
    if (!issue || !issue.file) {
      setSourceLoading(false);
      setSourceError(null);
      setSourcePayload(null);
      return;
    }

    void loadSource(selectedRunId, issue.file);
  }, [apiBaseUrl, selectedIssueIndex, selectedRun, selectedRunId, selectedSourceFilePath]);

  return (
    <main className="app">
      <header className="header">
        <h1>PHPSage Dashboard</h1>
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
          <button onClick={() => void loadRuns()} disabled={loading}>
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
      </section>

      {activeControlLabels.length > 0 ? (
        <section className="active-controls">
          {activeControlLabels.map((controlLabel) => (
            <span key={controlLabel}>{controlLabel}</span>
          ))}
        </section>
      ) : null}

      {error ? <p className="error">Could not load runs: {error}</p> : null}

      {!loading && runs.length === 0 ? <p className="empty">No runs yet.</p> : null}

      {visibleRuns.length > 0 ? (
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
                <td>{run.status}</td>
                <td>{run.exitCode ?? "-"}</td>
                <td>{run.issueCount}</td>
                <td className="mono">{run.targetPath}</td>
                <td>{new Date(run.updatedAt).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}

      {!loading && runs.length > 0 && visibleRuns.length === 0 ? (
        <p className="empty">No runs match current status filter.</p>
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
                ) : null}
              </section>
            </>
          ) : null}
        </section>
      ) : null}
    </main>
  );
}
