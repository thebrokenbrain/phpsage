import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { FileAiRagIngestStateStore } from "./file-ai-rag-ingest-state-store.js";
import { QdrantAiRagStore } from "./qdrant-ai-rag-store.js";

async function startQdrantMockServer(): Promise<{
  url: string;
  upsertedPoints: number[];
  close: () => Promise<void>;
}> {
  const upsertedPoints: number[] = [];

  const server = createServer(async (request: IncomingMessage, response: ServerResponse) => {
    if (request.method === "PUT" && request.url === "/collections/phpsage-rag") {
      response.statusCode = 200;
      response.end(JSON.stringify({ result: true }));
      return;
    }

    if (request.method === "PUT" && request.url === "/collections/phpsage-rag/points?wait=true") {
      let body = "";
      for await (const chunk of request) {
        body += chunk;
      }

      const payload = JSON.parse(body) as { points?: unknown[] };
      upsertedPoints.push(Array.isArray(payload.points) ? payload.points.length : 0);
      response.statusCode = 200;
      response.end(JSON.stringify({ status: "ok" }));
      return;
    }

    response.statusCode = 404;
    response.end();
  });

  await new Promise<void>((resolveStart) => {
    server.listen(0, "127.0.0.1", () => resolveStart());
  });

  const address = server.address();
  assert.ok(address && typeof address !== "string");

  return {
    url: `http://127.0.0.1:${address.port}`,
    upsertedPoints,
    close: () => new Promise<void>((resolveClose, rejectClose) => {
      server.close((error) => {
        if (error) {
          rejectClose(error);
          return;
        }

        resolveClose();
      });
    })
  };
}

test("QdrantAiRagStore reports ingest progress while upserting chunks", async () => {
  const directory = await mkdtemp(join(tmpdir(), "phpsage-qdrant-ingest-"));
  const qdrant = await startQdrantMockServer();

  try {
    await writeFile(join(directory, "alpha.md"), "# Alpha\n\nOne\n\nTwo", "utf-8");
    await writeFile(join(directory, "beta.md"), "# Beta\n\nThree\n\nFour", "utf-8");

    const stateStore = new FileAiRagIngestStateStore(join(directory, "rag-state.json"));
    const store = new QdrantAiRagStore(qdrant.url, "phpsage-rag", 16, 3, stateStore);
    const progress: number[] = [];
    const stats = await store.ingestDirectory(directory, (snapshot) => {
      progress.push(snapshot.progressPercent);
    });

    assert.equal(stats.filesIndexed, 2);
    assert.equal(stats.chunksIndexed, 2);
    assert.deepEqual(qdrant.upsertedPoints, [1, 1]);
    assert.ok(progress[0] === 0);
    assert.ok(progress.includes(50));
    assert.equal(progress.at(-1), 100);

    const secondProgress: number[] = [];
    const secondStats = await store.ingestDirectory(directory, (snapshot) => {
      secondProgress.push(snapshot.progressPercent);
    });

    assert.deepEqual(secondStats, stats);
    assert.deepEqual(qdrant.upsertedPoints, [1, 1]);
    assert.deepEqual(secondProgress, [100]);
  } finally {
    await qdrant.close();
    await rm(directory, { recursive: true, force: true });
  }
});