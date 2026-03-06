import assert from "node:assert/strict";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { test } from "node:test";
import { OllamaLlmClient } from "./ollama-llm-client.js";

async function startOllamaMockServer(): Promise<{
  baseUrl: string;
  state: { generateCalls: number };
  close: () => Promise<void>;
}> {
  const state = { generateCalls: 0 };

  const server = createServer(async (request: IncomingMessage, response: ServerResponse) => {
    if (!request.url) {
      response.statusCode = 400;
      response.end("missing url");
      return;
    }

    if (request.method === "POST" && request.url === "/api/generate") {
      state.generateCalls += 1;
      response.setHeader("content-type", "application/json");
      response.end(JSON.stringify({ response: "Ollama answer" }));
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

test("OllamaLlmClient calls /api/generate and returns text", async () => {
  const mock = await startOllamaMockServer();

  try {
    const client = new OllamaLlmClient(mock.baseUrl, "llama3.2", 1000);
    const output = await client.explain({
      issueMessage: "Undefined variable: $foo",
      issueIdentifier: "variable.undefined",
      filePath: "src/Example.php",
      line: 10,
      sourceSnippet: "return $foo;"
    });

    assert.equal(output.text, "Ollama answer");
    assert.equal(output.usage?.model, "llama3.2");
    assert.equal(mock.state.generateCalls, 1);
  } finally {
    await mock.close();
  }
});
