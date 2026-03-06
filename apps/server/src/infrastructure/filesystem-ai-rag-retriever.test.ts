// This file tests filesystem RAG retriever scoring and identifier matching.

import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { FilesystemAiRagRetriever } from "./filesystem-ai-rag-retriever.js";

test("prioritizes exact identifier match", async () => {
  const directory = await mkdtemp(join(tmpdir(), "phpsage-rag-retriever-"));

  try {
    await mkdir(join(directory, "nested"), { recursive: true });
    await writeFile(join(directory, "variable.undefined.md"), "Undefined variable guidance", "utf-8");
    await writeFile(join(directory, "nested", "other.issue.md"), "Other issue guidance", "utf-8");

    const retriever = new FilesystemAiRagRetriever(directory, 2);
    const items = await retriever.retrieve({
      issueMessage: "Undefined variable $foo",
      issueIdentifier: "variable.undefined"
    });

    assert.ok(items.length >= 1);
    assert.equal(items[0]?.identifier, "variable.undefined");
    assert.match(items[0]?.sourcePath ?? "", /variable\.undefined\.md$/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("returns empty when no document token matches query", async () => {
  const directory = await mkdtemp(join(tmpdir(), "phpsage-rag-retriever-"));

  try {
    await writeFile(join(directory, "first.md"), "alpha beta gamma", "utf-8");

    const retriever = new FilesystemAiRagRetriever(directory, 3);
    const items = await retriever.retrieve({
      issueMessage: "zzz yyy qqq"
    });

    assert.deepEqual(items, []);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
