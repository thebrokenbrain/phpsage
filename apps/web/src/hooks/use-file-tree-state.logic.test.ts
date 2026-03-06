import assert from "node:assert/strict";
import { test } from "node:test";
import {
  computeCurrentFilePosition,
  getExpandedDirectoriesForSelectedFile,
  toggleDirectoryCollapsedState
} from "./use-file-tree-state.js";
import type { RunFileTreeRow } from "../utils/run-file-tree.js";

test("computeCurrentFilePosition returns 0 when no selected file", () => {
  const position = computeCurrentFilePosition([], null);
  assert.equal(position, 0);
});

test("computeCurrentFilePosition returns one-based index for selected file", () => {
  const rows: RunFileTreeRow[] = [
    { key: "dir:src", type: "directory", path: "src", label: "src", depth: 0, hasIssues: false, issueCount: 0 },
    { key: "file:src/A.php", type: "file", path: "src/A.php", label: "A.php", depth: 1, hasIssues: false, issueCount: 0 },
    { key: "file:src/B.php", type: "file", path: "src/B.php", label: "B.php", depth: 1, hasIssues: false, issueCount: 0 }
  ];

  const position = computeCurrentFilePosition(rows, "src/B.php");
  assert.equal(position, 2);
});

test("getExpandedDirectoriesForSelectedFile removes collapsed ancestors of selected file", () => {
  const current = new Set(["src", "src/Domain", "tests"]);
  const next = getExpandedDirectoriesForSelectedFile(current, "src/Domain/Foo.php");

  assert.deepEqual(Array.from(next).sort(), ["tests"]);
});

test("toggleDirectoryCollapsedState adds collapsed directory when missing", () => {
  const next = toggleDirectoryCollapsedState(new Set(["tests"]), "src");
  assert.equal(next.has("src"), true);
  assert.equal(next.has("tests"), true);
});

test("toggleDirectoryCollapsedState removes expanded directory and descendants", () => {
  const current = new Set(["src", "src/Domain", "src/Domain/Model", "tests"]);
  const next = toggleDirectoryCollapsedState(current, "src");

  assert.equal(next.has("src"), false);
  assert.equal(next.has("src/Domain"), false);
  assert.equal(next.has("src/Domain/Model"), false);
  assert.equal(next.has("tests"), true);
});
