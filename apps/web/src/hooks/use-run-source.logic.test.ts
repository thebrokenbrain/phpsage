import assert from "node:assert/strict";
import { test } from "node:test";
import { buildRunSourceEndpoint } from "./use-run-source.js";

test("buildRunSourceEndpoint encodes file path safely", () => {
  const endpoint = buildRunSourceEndpoint(
    "http://localhost:8080",
    "run-123",
    "/workspace/examples/php-sample/src/Broken.php"
  );

  assert.equal(
    endpoint,
    "http://localhost:8080/api/runs/run-123/source?file=%2Fworkspace%2Fexamples%2Fphp-sample%2Fsrc%2FBroken.php"
  );
});
