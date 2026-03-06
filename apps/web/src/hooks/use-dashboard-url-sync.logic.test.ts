import assert from "node:assert/strict";
import { test } from "node:test";
import { buildDashboardUrlSearch } from "./use-dashboard-url-sync.js";

test("buildDashboardUrlSearch returns minimal query when all defaults are used", () => {
  const query = buildDashboardUrlSearch({
    selectedRunId: null,
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
    autoRunIntervalMs: 15000,
    autoRunTargetMode: "starter",
    autoRunPauseWhenHidden: true,
    autoRunMaxFailures: 3,
    startRunTargetPath: "/workspace/examples/php-sample",
    isLivePollingEnabled: true,
    livePollingIntervalMs: 2000,
    selectedSourceFilePath: null,
    selectedIssueIndex: 0,
    logPage: 0,
    hasIssuesForSelectedRun: false,
    hasLogsForSelectedRun: false,
    defaultRunningPollIntervalMs: 2000
  });

  assert.equal(query, "?target=%2Fworkspace%2Fexamples%2Fphp-sample");
});

test("buildDashboardUrlSearch includes non-default controls and context", () => {
  const query = buildDashboardUrlSearch({
    selectedRunId: "run-123",
    runsStatusFilter: "finished",
    runsSortOrder: "updatedAsc",
    fileSearchTerm: "src",
    issueSearchTerm: "undefined",
    issueIdentifierFilter: "with",
    logSearchTerm: "fatal",
    logStreamFilter: "stderr",
    isFilesSectionOpen: false,
    isIssuesSectionOpen: false,
    isSourceSectionOpen: false,
    isLogsSectionOpen: false,
    isAutoRunEnabled: true,
    autoRunIntervalMs: 30000,
    autoRunTargetMode: "selected",
    autoRunPauseWhenHidden: false,
    autoRunMaxFailures: 5,
    startRunTargetPath: "/workspace/examples/php-sample-ok",
    isLivePollingEnabled: false,
    livePollingIntervalMs: 5000,
    selectedSourceFilePath: "/workspace/examples/php-sample/src/Broken.php",
    selectedIssueIndex: 4,
    logPage: 2,
    hasIssuesForSelectedRun: true,
    hasLogsForSelectedRun: true,
    defaultRunningPollIntervalMs: 2000
  });

  assert.ok(query.includes("runId=run-123"));
  assert.ok(query.includes("status=finished"));
  assert.ok(query.includes("auto=1"));
  assert.ok(query.includes("issue=4"));
  assert.ok(query.includes("logPage=2"));
  assert.ok(query.includes("file=%2Fworkspace%2Fexamples%2Fphp-sample%2Fsrc%2FBroken.php"));
});
