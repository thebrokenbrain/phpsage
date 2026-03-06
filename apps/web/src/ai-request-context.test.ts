import assert from "node:assert/strict";
import { test } from "node:test";
import { buildAiRequestKey, getCachedValueWithLru, setCachedValueWithLru } from "./ai-request-context.js";

test("buildAiRequestKey uses all context fields to avoid collisions", () => {
  const baseIssue = {
    file: "/workspace/examples/php-sample/src/Broken.php",
    line: 7,
    message: "Undefined variable: $undefinedVariable"
  };

  const keyA = buildAiRequestKey(baseIssue, "return $undefinedVariable + $value;");
  const keyB = buildAiRequestKey({ ...baseIssue, line: 8 }, "return $undefinedVariable + $value;");
  const keyC = buildAiRequestKey({ ...baseIssue, identifier: "variable.undefined" }, "return $undefinedVariable + $value;");
  const keyD = buildAiRequestKey({ ...baseIssue, identifier: "variable.undefined" }, "return $other;");

  assert.notEqual(keyA, keyB);
  assert.notEqual(keyA, keyC);
  assert.notEqual(keyC, keyD);
});

test("buildAiRequestKey is stable for identical context", () => {
  const issue = {
    file: "/workspace/examples/php-sample/src/Broken.php",
    line: 7,
    message: "Undefined variable: $undefinedVariable",
    identifier: "variable.undefined"
  };

  const first = buildAiRequestKey(issue, "return $undefinedVariable + $value;");
  const second = buildAiRequestKey(issue, "return $undefinedVariable + $value;");

  assert.equal(first, second);
});

test("setCachedValueWithLru evicts oldest entries when cache exceeds max size", () => {
  const cache = new Map<string, string>();

  setCachedValueWithLru(cache, "a", "A", 2);
  setCachedValueWithLru(cache, "b", "B", 2);
  setCachedValueWithLru(cache, "c", "C", 2);

  assert.equal(cache.size, 2);
  assert.equal(cache.has("a"), false);
  assert.equal(cache.get("b"), "B");
  assert.equal(cache.get("c"), "C");
});

test("getCachedValueWithLru refreshes entry recency", () => {
  const cache = new Map<string, string>();

  setCachedValueWithLru(cache, "a", "A", 2);
  setCachedValueWithLru(cache, "b", "B", 2);

  const cachedA = getCachedValueWithLru(cache, "a");
  assert.equal(cachedA, "A");

  setCachedValueWithLru(cache, "c", "C", 2);

  assert.equal(cache.has("a"), true);
  assert.equal(cache.has("b"), false);
  assert.equal(cache.get("c"), "C");
});
