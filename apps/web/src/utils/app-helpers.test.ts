import assert from "node:assert/strict";
import { test } from "node:test";
import { filterDuplicateAiRecommendations, formatError, getIssueContextKey, getIssueKey } from "./app-helpers.js";

test("getIssueKey creates stable key from issue location and message", () => {
  const key = getIssueKey({
    file: "/workspace/src/Foo.php",
    line: 12,
    message: "Undefined variable: $foo"
  });

  assert.equal(key, "/workspace/src/Foo.php::12::Undefined variable: $foo");
});

test("getIssueContextKey includes identifier and defaults to unknown", () => {
  const withIdentifier = getIssueContextKey({
    file: "/workspace/src/Foo.php",
    line: 12,
    message: "Undefined variable: $foo",
    identifier: "variable.undefined"
  });
  const withoutIdentifier = getIssueContextKey({
    file: "/workspace/src/Foo.php",
    line: 12,
    message: "Undefined variable: $foo"
  });

  assert.equal(withIdentifier, "/workspace/src/Foo.php::12::Undefined variable: $foo::variable.undefined");
  assert.equal(withoutIdentifier, "/workspace/src/Foo.php::12::Undefined variable: $foo::unknown");
});

test("formatError returns message for Error and stringifies other values", () => {
  assert.equal(formatError(new Error("boom")), "boom");
  assert.equal(formatError(42), "42");
});

test("filterDuplicateAiRecommendations removes recommendations already present in explanation", () => {
  const filtered = filterDuplicateAiRecommendations(
    [
      "- Cast or convert the argument to an integer at the call site.",
      "- If string IDs are valid in your app, update the method signature."
    ].join("\n"),
    [
      "Cast or convert the argument to an integer at the call site.",
      "If string IDs are valid in your app, update the method signature.",
      "Keep validation close to the input boundary."
    ]
  );

  assert.deepEqual(filtered, ["Keep validation close to the input boundary."]);
});

test("filterDuplicateAiRecommendations deduplicates repeated recommendation entries", () => {
  const filtered = filterDuplicateAiRecommendations("Short explanation", ["Use an int", "Use an int", "Normalize input"]);

  assert.deepEqual(filtered, ["Use an int", "Normalize input"]);
});
