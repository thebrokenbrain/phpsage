// This file tests RAG context propagation in explain and suggest-fix services.

import assert from "node:assert/strict";
import { test } from "node:test";
import { AiExplainService } from "./ai-explain-service.js";
import { AiSuggestFixService } from "./ai-suggest-fix-service.js";
import type { AiLlmClient } from "../ports/ai-llm-client.js";
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

test("AiExplainService uses llm output when client is available", async () => {
  const llmClient: AiLlmClient = {
    explain: async () => ({
      text: "Issue explanation\n- Recommendation A\n- Recommendation B",
      usage: {
        model: "gpt-4o-mini",
        inputTokens: 10,
        outputTokens: 20,
        totalTokens: 30
      },
      debug: null
    }),
    suggestFix: async () => ({ text: "", usage: null, debug: null })
  };

  const service = new AiExplainService("openai", retriever, 3, llmClient);
  const result = await service.explain({
    issueMessage: "Undefined variable: $foo",
    issueIdentifier: "variable.undefined"
  });

  assert.equal(result.source, "llm");
  assert.equal(result.fallbackReason, null);
  assert.equal(result.usage?.totalTokens, 30);
  assert.deepEqual(result.recommendations, ["Recommendation A", "Recommendation B"]);
});

test("AiSuggestFixService falls back when llm output is invalid", async () => {
  const llmClient: AiLlmClient = {
    explain: async () => ({ text: "", usage: null, debug: null }),
    suggestFix: async () => ({ text: "{}", usage: null, debug: null })
  };

  const service = new AiSuggestFixService("openai", retriever, 3, llmClient);
  const result = await service.suggestFix({
    issueMessage: "Undefined variable: $undefinedVariable",
    issueIdentifier: "variable.undefined",
    filePath: "src/Broken.php",
    line: 7,
    sourceSnippet: "return $undefinedVariable + $value;"
  });

  assert.equal(result.source, "fallback");
  assert.match(result.fallbackReason ?? "", /LLM request failed/i);
});
