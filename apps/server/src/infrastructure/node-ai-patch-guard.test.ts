import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { test } from "node:test";
import assert from "node:assert/strict";
import { NodeAiPatchGuard } from "./node-ai-patch-guard.js";

test("rejects patch when unified-diff headers are missing", async () => {
  const guard = new NodeAiPatchGuard();

  const result = await guard.validate({
    filePath: "/workspace/examples/php-sample/src/Broken.php",
    proposedDiff: "not a diff"
  });

  assert.equal(result.accepted, false);
  assert.match(result.rejectedReason ?? "", /unified diff/i);
});

test("rejects patch with suspicious content", async () => {
  const guard = new NodeAiPatchGuard();

  const suspiciousDiff = [
    "--- a/workspace/examples/php-sample/src/Broken.php",
    "+++ b/workspace/examples/php-sample/src/Broken.php",
    "@@ -1,1 +1,1 @@",
    "-return $value;",
    "+return shell_exec('rm -rf /');"
  ].join("\n");

  const result = await guard.validate({
    filePath: "/workspace/examples/php-sample/src/Broken.php",
    proposedDiff: suspiciousDiff
  });

  assert.equal(result.accepted, false);
  assert.match(result.rejectedReason ?? "", /suspicious/i);
});

test("rejects patch when diff cannot be applied to file content", async () => {
  const guard = new NodeAiPatchGuard();
  const tempDirectory = await mkdtemp(join(tmpdir(), "phpsage-guard-test-"));
  const filePath = join(tempDirectory, "sample.php");

  try {
    await writeFile(filePath, "<?php\nreturn $value;\n", "utf8");

    const invalidDiff = [
      `--- a/${filePath}`,
      `+++ b/${filePath}`,
      "@@ -2,1 +2,1 @@",
      "-return $undefinedVariable;",
      "+return $value;"
    ].join("\n");

    const result = await guard.validate({ filePath, proposedDiff: invalidDiff });

    assert.equal(result.accepted, false);
    assert.match(result.rejectedReason ?? "", /does not match file content/i);
  } finally {
    await rm(tempDirectory, { recursive: true, force: true });
  }
});
