// This file composes server dependencies and starts the HTTP API.
import { resolve } from "node:path";
import { AiExplainService } from "./application/ai-explain-service.js";
import { AiIngestService } from "./application/ai-ingest-service.js";
import { AiSuggestFixService } from "./application/ai-suggest-fix-service.js";
import { RunService } from "./application/run-service.js";
import { FileRunRepository } from "./infrastructure/file-run-repository.js";
import { InMemoryAiIngestJobRepository } from "./infrastructure/in-memory-ai-ingest-job-repository.js";
import { NoopAiIngestProcessor } from "./infrastructure/noop-ai-ingest-processor.js";
import { RunSourceReader } from "./infrastructure/run-source-reader.js";
import { createHttpServer } from "./interfaces/http-server.js";

const port = Number(process.env.PORT ?? 8080);
const runsDirectoryPath = resolve(process.cwd(), "data/runs");

const runRepository = new FileRunRepository(runsDirectoryPath);
const runService = new RunService(runRepository);
const runSourceReader = new RunSourceReader();
const aiIngestService = new AiIngestService(new InMemoryAiIngestJobRepository(), new NoopAiIngestProcessor());
const aiExplainService = new AiExplainService(process.env.PHPSAGE_AI_PROVIDER?.trim() || "fallback");
const aiSuggestFixService = new AiSuggestFixService(process.env.PHPSAGE_AI_PROVIDER?.trim() || "fallback");
const server = createHttpServer(runService, runSourceReader, aiIngestService, aiExplainService, aiSuggestFixService);

server.listen(port, () => {
  process.stdout.write(`phpsage-server listening on :${port}\n`);
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    server.close(() => {
      process.exit(0);
    });
  });
}
