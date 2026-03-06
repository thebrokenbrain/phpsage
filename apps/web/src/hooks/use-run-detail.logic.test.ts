import assert from "node:assert/strict";
import { test } from "node:test";
import { buildRunDetailEndpoint } from "./use-run-detail.js";

test("buildRunDetailEndpoint builds expected run detail URL", () => {
  const endpoint = buildRunDetailEndpoint("http://localhost:8080", "run-123");
  assert.equal(endpoint, "http://localhost:8080/api/runs/run-123");
});
