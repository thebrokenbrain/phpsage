import assert from "node:assert/strict";
import { test } from "node:test";
import { formatError, getIssueContextKey, getIssueKey } from "./app-helpers.js";

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
