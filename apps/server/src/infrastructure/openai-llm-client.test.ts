import assert from "node:assert/strict";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { test } from "node:test";
import { OpenAiLlmClient } from "./openai-llm-client.js";

async function startOpenAiMockServer(): Promise<{
  baseUrl: string;
  state: { responsesCalls: number; chatCalls: number };
  close: () => Promise<void>;
}> {
  const state = { responsesCalls: 0, chatCalls: 0 };

  const server = createServer(async (request: IncomingMessage, response: ServerResponse) => {
    if (!request.url) {
      response.statusCode = 400;
      response.end("missing url");
      return;
    }

    if (request.method === "POST" && request.url === "/v1/responses") {
      state.responsesCalls += 1;
      response.statusCode = 404;
      response.end("not found");
      return;
    }

    if (request.method === "POST" && request.url === "/v1/chat/completions") {
      state.chatCalls += 1;
      response.setHeader("content-type", "application/json");
      response.end(JSON.stringify({
        choices: [{ message: { content: "Fallback answer" } }],
        usage: { prompt_tokens: 3, completion_tokens: 7, total_tokens: 10 }
      }));
      return;
    }

    response.statusCode = 404;
    response.end("not found");
  });

  await new Promise<void>((resolveStart) => {
    server.listen(0, "127.0.0.1", () => {
      resolveStart();
    });
  });

  const address = server.address();
  assert.ok(address && typeof address !== "string");

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    state,
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

test("OpenAiLlmClient falls back from responses to chat/completions", async () => {
  const mock = await startOpenAiMockServer();

  try {
    const client = new OpenAiLlmClient(mock.baseUrl, "test-key", "gpt-4o-mini", 1000);
    const output = await client.explain({
      issueMessage: "Undefined variable: $foo",
      issueIdentifier: "variable.undefined",
      filePath: "src/Example.php",
      line: 10,
      sourceSnippet: "return $foo;"
    });

    assert.equal(output.text, "Fallback answer");
    assert.equal(output.usage?.totalTokens, 10);
    assert.equal(mock.state.responsesCalls, 1);
    assert.equal(mock.state.chatCalls, 1);
  } finally {
    await mock.close();
  }
});
