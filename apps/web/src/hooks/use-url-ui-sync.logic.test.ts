import assert from "node:assert/strict";
import { test } from "node:test";
import { buildUrlSyncPayload } from "./use-url-ui-sync.js";

test("buildUrlSyncPayload maps UI state into sync payload", () => {
  const payload = buildUrlSyncPayload({
    selectedRunId: "run-123",
    safeIssueIndex: 4,
    viewMode: "dashboard",
    hasIssues: true
  });

  assert.deepEqual(payload, {
    runId: "run-123",
    issueIndex: 4,
    viewMode: "dashboard",
    hasIssues: true
  });
});

test("buildUrlSyncPayload keeps nullable runId and no-issues state", () => {
  const payload = buildUrlSyncPayload({
    selectedRunId: null,
    safeIssueIndex: 0,
    viewMode: "insights",
    hasIssues: false
  });

  assert.deepEqual(payload, {
    runId: null,
    issueIndex: 0,
    viewMode: "insights",
    hasIssues: false
  });
});
