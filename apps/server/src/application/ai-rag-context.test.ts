// This file tests shared AI context utilities used by explain/suggest services.

import assert from "node:assert/strict";
import { test } from "node:test";
import { formatRetrievedContext, retrieveContextItemsSafely, toErrorMessage } from "./ai-rag-context.js";
import type { AiRagRetriever } from "../ports/ai-rag-retriever.js";

test("retrieveContextItemsSafely returns empty list when retriever is missing", async () => {
  const result = await retrieveContextItemsSafely(undefined, {
    issueMessage: "Undefined variable",
    issueIdentifier: "variable.undefined"
  });

  assert.deepEqual(result, []);
});

test("retrieveContextItemsSafely returns retrieved items", async () => {
  const retriever: AiRagRetriever = {
    retrieve: async () => [
      {
        sourcePath: "rag/variable.undefined.md",
        identifier: "variable.undefined",
        content: "Initialize variable before use.",
        score: 0.9345
      }
    ]
  };

  const items = await retrieveContextItemsSafely(retriever, {
    issueMessage: "Undefined variable",
    issueIdentifier: "variable.undefined"
  });

  assert.equal(items.length, 1);
  assert.equal(items[0]?.identifier, "variable.undefined");

  const formatted = formatRetrievedContext(items);
  assert.equal(
    formatted,
    "Context 1 (identifier=variable.undefined, source=rag/variable.undefined.md, score=0.934):\nInitialize variable before use."
  );
});

test("retrieveContextItemsSafely swallows retriever errors", async () => {
  const retriever: AiRagRetriever = {
    retrieve: async () => {
      throw new Error("temporary retriever failure");
    }
  };

  const result = await retrieveContextItemsSafely(retriever, {
    issueMessage: "Undefined variable"
  });

  assert.deepEqual(result, []);
});

test("toErrorMessage handles both Error and unknown values", () => {
  assert.equal(toErrorMessage(new Error("boom")), "boom");
  assert.equal(toErrorMessage({ code: 500 }), "[object Object]");
});
