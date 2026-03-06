import assert from "node:assert/strict";
import { test } from "node:test";
import { findFirstIssueIndexForFile, getBoundedIssueIndex } from "./use-issue-navigation.js";

test("getBoundedIssueIndex clamps values within issue range", () => {
  assert.equal(getBoundedIssueIndex(-5, 3), 0);
  assert.equal(getBoundedIssueIndex(10, 3), 2);
  assert.equal(getBoundedIssueIndex(1, 3), 1);
  assert.equal(getBoundedIssueIndex(0, 0), 0);
});

test("findFirstIssueIndexForFile selects earliest issue in file by line and index", () => {
  const issues = [
    { file: "/workspace/src/Foo.php", line: 30, message: "A" },
    { file: "/workspace/src/Foo.php", line: 10, message: "B" },
    { file: "/workspace/src/Bar.php", line: 5, message: "C" },
    { file: "/workspace/src/Foo.php", line: 10, message: "D" }
  ];

  const firstIssueIndex = findFirstIssueIndexForFile(issues, "/workspace", "src/Foo.php");
  assert.equal(firstIssueIndex, 1);
});

test("findFirstIssueIndexForFile returns -1 when no issue matches file", () => {
  const issues = [{ file: "/workspace/src/Foo.php", line: 1, message: "A" }];
  const firstIssueIndex = findFirstIssueIndexForFile(issues, "/workspace", "src/Other.php");
  assert.equal(firstIssueIndex, -1);
});
import assert from "node:assert/strict";
import { test } from "node:test";
import { findFirstIssueIndexForFile, getBoundedIssueIndex } from "./use-issue-navigation.js";

test("getBoundedIssueIndex clamps values within issue range", () => {
  assert.equal(getBoundedIssueIndex(-5, 3), 0);
  assert.equal(getBoundedIssueIndex(10, 3), 2);
  assert.equal(getBoundedIssueIndex(1, 3), 1);
  assert.equal(getBoundedIssueIndex(0, 0), 0);
});

test("findFirstIssueIndexForFile selects earliest issue in file by line and index", () => {
  const issues = [
    { file: "/workspace/src/Foo.php", line: 30, message: "A" },
    { file: "/workspace/src/Foo.php", line: 10, message: "B" },
    { file: "/workspace/src/Bar.php", line: 5, message: "C" },
    { file: "/workspace/src/Foo.php", line: 10, message: "D" }
  ];

  const firstIssueIndex = findFirstIssueIndexForFile(issues, "/workspace", "src/Foo.php");
  assert.equal(firstIssueIndex, 1);
});

test("findFirstIssueIndexForFile returns -1 when no issue matches file", () => {
  const issues = [{ file: "/workspace/src/Foo.php", line: 1, message: "A" }];
  const firstIssueIndex = findFirstIssueIndexForFile(issues, "/workspace", "src/Other.php");
  assert.equal(firstIssueIndex, -1);
});
