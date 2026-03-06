// This file tests pure view-model helpers used by App state derivation.
import assert from "node:assert/strict";
import { test } from "node:test";
import { buildFileIssuesForViewer, buildIssueIdentifierCounts, getSafeIssueIndex } from "./use-run-view-model.js";
import type { RunIssue } from "../types.js";

test("getSafeIssueIndex keeps index within issue bounds", () => {
  assert.equal(getSafeIssueIndex(0, 4), 0);
  assert.equal(getSafeIssueIndex(3, 1), 1);
  assert.equal(getSafeIssueIndex(2, 5), 1);
});

test("buildIssueIdentifierCounts groups missing identifiers as unknown", () => {
  const issues: RunIssue[] = [
    { file: "/workspace/src/Foo.php", line: 3, message: "A", identifier: "id.a" },
    { file: "/workspace/src/Foo.php", line: 6, message: "B" },
    { file: "/workspace/src/Foo.php", line: 8, message: "C", identifier: "id.a" }
  ];

  const counts = buildIssueIdentifierCounts(issues);
  assert.deepEqual(counts, [["id.a", 2], ["unknown", 1]]);
});

test("buildFileIssuesForViewer returns file-local issues sorted by line and index", () => {
  const issues: RunIssue[] = [
    { file: "/workspace/src/B.php", line: 7, message: "B7" },
    { file: "/workspace/src/A.php", line: 3, message: "A3" },
    { file: "/workspace/src/A.php", line: 3, message: "A3-second" },
    { file: "/workspace/src/A.php", line: 9, message: "A9" }
  ];

  const result = buildFileIssuesForViewer(issues, "/workspace", "src/A.php");
  assert.deepEqual(result.map((entry) => `${entry.issue.line}:${entry.issue.message}`), [
    "3:A3",
    "3:A3-second",
    "9:A9"
  ]);
});