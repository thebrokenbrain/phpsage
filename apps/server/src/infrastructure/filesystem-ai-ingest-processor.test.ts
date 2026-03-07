// This file tests filesystem ingest stats for files and chunks.

import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { FilesystemAiIngestProcessor } from "./filesystem-ai-ingest-processor.js";

function buildLines(total: number): string {
  return Array.from({ length: total }, (_, index) => `line-${index + 1}`).join("\n");
}

test("indexes regular files recursively and computes chunk count", async () => {
  const directory = await mkdtemp(join(tmpdir(), "phpsage-ai-ingest-fs-"));

  try {
    await mkdir(join(directory, "src"), { recursive: true });
    await writeFile(join(directory, "src", "A.php"), buildLines(30), "utf-8");
    await writeFile(join(directory, "src", "B.md"), buildLines(250), "utf-8");

    const processor = new FilesystemAiIngestProcessor();
    const stats = await processor.ingest(directory);

    assert.equal(stats.filesIndexed, 2);
    assert.equal(stats.chunksIndexed, 4);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("ignores configured directories", async () => {
  const directory = await mkdtemp(join(tmpdir(), "phpsage-ai-ingest-fs-"));

  try {
    await mkdir(join(directory, ".git"), { recursive: true });
    await mkdir(join(directory, "node_modules", "pkg"), { recursive: true });
    await mkdir(join(directory, "docs"), { recursive: true });

    await writeFile(join(directory, ".git", "config"), "[core]", "utf-8");
    await writeFile(join(directory, "node_modules", "pkg", "index.js"), "console.log('x')", "utf-8");
    await writeFile(join(directory, "docs", "guide.md"), buildLines(10), "utf-8");

    const processor = new FilesystemAiIngestProcessor();
    const stats = await processor.ingest(directory);

    assert.equal(stats.filesIndexed, 1);
    assert.equal(stats.chunksIndexed, 1);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("reports completed progress snapshot when filesystem ingest finishes", async () => {
  const directory = await mkdtemp(join(tmpdir(), "phpsage-ai-ingest-fs-"));

  try {
    await writeFile(join(directory, "guide.md"), buildLines(10), "utf-8");

    const processor = new FilesystemAiIngestProcessor();
    const progressSnapshots: number[] = [];
    const stats = await processor.ingest(directory, (progress) => {
      progressSnapshots.push(progress.progressPercent);
    });

    assert.deepEqual(stats, { filesIndexed: 1, chunksIndexed: 1 });
    assert.deepEqual(progressSnapshots, [100]);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
