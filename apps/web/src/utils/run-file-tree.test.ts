import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildFileTreeRows,
  getParentDirectoryPaths,
  isPathDescendantOf,
  toAbsoluteRunPath,
  toRelativeRunPath
} from "./run-file-tree.js";

test("toRelativeRunPath returns project-relative path", () => {
  const relativePath = toRelativeRunPath("/workspace/project", "/workspace/project/src/Foo.php");
  assert.equal(relativePath, "src/Foo.php");
});

test("toAbsoluteRunPath prefixes relative file paths with target", () => {
  const absolutePath = toAbsoluteRunPath("/workspace/project", "src/Foo.php");
  assert.equal(absolutePath, "/workspace/project/src/Foo.php");
});

test("buildFileTreeRows creates directory and file rows", () => {
  const rows = buildFileTreeRows([
    { path: "src/Foo.php", hasIssues: true, issueCount: 2 },
    { path: "src/Domain/Bar.php", hasIssues: false, issueCount: 0 }
  ]);

  const directoryRows = rows.filter((row) => row.type === "directory");
  const fileRows = rows.filter((row) => row.type === "file");

  assert.ok(directoryRows.some((row) => row.path === "src"));
  assert.ok(directoryRows.some((row) => row.path === "src/Domain"));
  assert.equal(fileRows.length, 2);
  assert.ok(fileRows.some((row) => row.path === "src/Foo.php" && row.issueCount === 2));
});

test("getParentDirectoryPaths returns all parent directories in order", () => {
  const parents = getParentDirectoryPaths("src/Domain/Model/Foo.php");
  assert.deepEqual(parents, ["src", "src/Domain", "src/Domain/Model"]);
});

test("isPathDescendantOf checks ancestry safely", () => {
  assert.equal(isPathDescendantOf("src/Domain/Foo.php", "src"), true);
  assert.equal(isPathDescendantOf("src", "src"), false);
  assert.equal(isPathDescendantOf("tests/Foo.php", "src"), false);
});
