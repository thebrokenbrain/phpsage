import assert from "node:assert/strict";
import { test } from "node:test";
import { buildRunFilesEndpoint } from "./use-run-files.js";

test("buildRunFilesEndpoint builds expected files URL", () => {
  const endpoint = buildRunFilesEndpoint("http://localhost:8080", "run-123");
  assert.equal(endpoint, "http://localhost:8080/api/runs/run-123/files");
});
