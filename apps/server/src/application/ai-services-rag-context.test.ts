// This file tests RAG context propagation in explain and suggest-fix services.

import assert from "node:assert/strict";
import { test } from "node:test";
import { AiExplainService } from "./ai-explain-service.js";
import { AiSuggestFixService } from "./ai-suggest-fix-service.js";
import type { AiRagRetriever } from "../ports/ai-rag-retriever.js";

const retriever: AiRagRetriever = {
  retrieve: async () => [
    {
      sourcePath: "variable.undefined.md",
      identifier: "variable.undefined",
      content: "Initialize variable before use.",
      score: 0.9123
    }
  ]
};

test("AiExplainService includes retrieved context items", async () => {
  const service = new AiExplainService("fallback", retriever);
  const result = await service.explain({
    issueMessage: "Undefined variable: $foo",
    issueIdentifier: "variable.undefined",
    filePath: "src/Broken.php",
    line: 7,
    sourceSnippet: "return $foo;"
  });

  assert.equal(result.contextItems.length, 1);
  assert.equal(result.contextItems[0]?.identifier, "variable.undefined");
});

test("AiSuggestFixService includes retrieved context items", async () => {
  const service = new AiSuggestFixService("fallback", retriever);
  const result = await service.suggestFix({
    issueMessage: "Undefined variable: $undefinedVariable",
    issueIdentifier: "variable.undefined",
    filePath: "src/Broken.php",
    line: 7,
    sourceSnippet: "return $undefinedVariable + $value;"
  });

  assert.equal(result.contextItems.length, 1);
  assert.equal(result.contextItems[0]?.sourcePath, "variable.undefined.md");
  assert.match(result.proposedDiff, /\+return \$value \+ \$value;/);
});
