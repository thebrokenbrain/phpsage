export interface InitialQuerySelection {
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
  isAutoRunEnabled: boolean;
  autoRunIntervalMs: number | null;
  autoRunTargetMode: "starter" | "selected";
  autoRunPauseWhenHidden: boolean;
  autoRunMaxFailures: number | null;
  startTargetPath: string | null;
  isLivePollingEnabled: boolean;
  livePollingIntervalMs: number | null;
}

export function readInitialQuerySelection(): InitialQuerySelection {
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
      isAutoRunEnabled: false,
      autoRunIntervalMs: null,
      autoRunTargetMode: "starter",
      autoRunPauseWhenHidden: true,
      autoRunMaxFailures: null,
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
  const auto = searchParams.get("auto");
  const autoInterval = searchParams.get("autoInterval");
  const autoTarget = searchParams.get("autoTarget");
  const autoPauseHidden = searchParams.get("autoPauseHidden");
  const autoMaxFailures = searchParams.get("autoMaxFailures");
  const target = searchParams.get("target");
  const live = searchParams.get("live");
  const interval = searchParams.get("interval");
  const parsedIssueIndex = issue ? Number.parseInt(issue, 10) : Number.NaN;
  const parsedLogPage = logPage ? Number.parseInt(logPage, 10) : Number.NaN;
  const parsedInterval = interval ? Number.parseInt(interval, 10) : Number.NaN;
  const parsedAutoInterval = autoInterval ? Number.parseInt(autoInterval, 10) : Number.NaN;
  const parsedAutoMaxFailures = autoMaxFailures ? Number.parseInt(autoMaxFailures, 10) : Number.NaN;

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
    isAutoRunEnabled: auto === "1",
    autoRunIntervalMs: Number.isFinite(parsedAutoInterval) && parsedAutoInterval > 0 ? parsedAutoInterval : null,
    autoRunTargetMode: autoTarget === "selected" ? "selected" : "starter",
    autoRunPauseWhenHidden: autoPauseHidden !== "0",
    autoRunMaxFailures: Number.isFinite(parsedAutoMaxFailures) && parsedAutoMaxFailures > 0 ? parsedAutoMaxFailures : null,
    startTargetPath: target && target.trim().length > 0 ? target : null,
    isLivePollingEnabled: live !== "0",
    livePollingIntervalMs: Number.isFinite(parsedInterval) && parsedInterval > 0 ? parsedInterval : null
  };
}