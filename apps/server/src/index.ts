// This file composes server dependencies and starts the HTTP API.
import { resolve } from "node:path";
import { AiExplainService } from "./application/ai-explain-service.js";
import { AiIngestService } from "./application/ai-ingest-service.js";
import { AiSuggestFixService } from "./application/ai-suggest-fix-service.js";
import { RunService } from "./application/run-service.js";
import { FileAiIngestJobRepository } from "./infrastructure/file-ai-ingest-job-repository.js";
import { FilesystemAiRagRetriever } from "./infrastructure/filesystem-ai-rag-retriever.js";
import { FileRunRepository } from "./infrastructure/file-run-repository.js";
import { FilesystemAiIngestProcessor } from "./infrastructure/filesystem-ai-ingest-processor.js";
import { QdrantAiRagStore } from "./infrastructure/qdrant-ai-rag-store.js";
import { OpenAiLlmClient } from "./infrastructure/openai-llm-client.js";
import { RunSourceReader } from "./infrastructure/run-source-reader.js";
import { createHttpServer } from "./interfaces/http-server.js";

const port = Number(process.env.PORT ?? 8080);
const runsDirectoryPath = resolve(process.cwd(), "data/runs");
const aiIngestJobsDirectoryPath = resolve(process.cwd(), "data/ai/ingest-jobs");
const aiRagDirectoryPath = resolve(process.cwd(), process.env.AI_RAG_DIRECTORY?.trim() || "rag");
const aiRagTopK = readPositiveIntegerEnvOrDefault("AI_RAG_TOP_K", 3);
const aiRagBackend = (process.env.AI_RAG_BACKEND?.trim().toLowerCase() || "filesystem") as "filesystem" | "qdrant";
const qdrantUrl = process.env.QDRANT_URL?.trim() || "http://qdrant:6333";
const qdrantCollection = process.env.QDRANT_COLLECTION?.trim() || "phpsage-rag";
const aiRagAutoIngestOnBoot = readBooleanEnvOrDefault("AI_RAG_AUTO_INGEST_ON_BOOT", false);
const aiIngestDefaultTarget = process.env.AI_INGEST_DEFAULT_TARGET?.trim() || "/workspace/rag";
const aiProvider = process.env.PHPSAGE_AI_PROVIDER?.trim() || process.env.AI_PROVIDER?.trim() || "fallback";
const aiDebugLlmIo = readBooleanEnvOrDefault("AI_DEBUG_LLM_IO", false);
const openAiBaseUrl = process.env.OPENAI_BASE_URL?.trim() || "https://api.openai.com";
const openAiApiKey = process.env.OPENAI_API_KEY?.trim() || "";
const openAiModel = process.env.OPENAI_MODEL?.trim() || process.env.PHPSAGE_AI_MODEL?.trim() || "gpt-4o-mini";
const aiRequestTimeoutMs = readPositiveIntegerEnvOrDefault("AI_HEALTH_TIMEOUT_MS", 5000);

const runRepository = new FileRunRepository(runsDirectoryPath);
const runService = new RunService(runRepository);
const runSourceReader = new RunSourceReader();
const qdrantStore = aiRagBackend === "qdrant" ? new QdrantAiRagStore(qdrantUrl, qdrantCollection, 256, aiRagTopK) : undefined;
const aiIngestService = new AiIngestService(
  new FileAiIngestJobRepository(aiIngestJobsDirectoryPath),
  new FilesystemAiIngestProcessor(qdrantStore)
);
const aiRagRetriever = qdrantStore ?? new FilesystemAiRagRetriever(aiRagDirectoryPath, aiRagTopK);
const openAiLlmClient = aiProvider === "openai" && openAiApiKey.length > 0
  ? new OpenAiLlmClient(openAiBaseUrl, openAiApiKey, openAiModel, aiRequestTimeoutMs, aiDebugLlmIo)
  : undefined;
const aiExplainService = new AiExplainService(aiProvider, aiRagRetriever, aiRagTopK, openAiLlmClient);
const aiSuggestFixService = new AiSuggestFixService(aiProvider, aiRagRetriever, aiRagTopK, openAiLlmClient);
const server = createHttpServer(runService, runSourceReader, aiIngestService, aiExplainService, aiSuggestFixService);

server.listen(port, () => {
  process.stdout.write(`phpsage-server listening on :${port}\n`);

  if (aiRagAutoIngestOnBoot) {
    void triggerAutoIngestOnBoot(aiIngestService, aiIngestDefaultTarget);
  }
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    server.close(() => {
      process.exit(0);
    });
  });
}

function readPositiveIntegerEnvOrDefault(name: string, fallback: number): number {
  const rawValue = process.env[name];
  if (!rawValue || rawValue.trim().length === 0) {
    return fallback;
  }

  const parsedValue = Number.parseInt(rawValue.trim(), 10);
  if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
    return fallback;
  }

  return parsedValue;
}

function readBooleanEnvOrDefault(name: string, fallback: boolean): boolean {
  const value = process.env[name];
  if (!value || value.trim().length === 0) {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }

  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }

  return fallback;
}

async function triggerAutoIngestOnBoot(aiIngestService: AiIngestService, targetPath: string): Promise<void> {
  try {
    const job = await aiIngestService.start(targetPath);
    process.stdout.write(`[ai-rag] auto-ingest scheduled: jobId=${job.jobId} target=${job.targetPath}\n`);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    process.stderr.write(`[ai-rag] auto-ingest failed to schedule: ${reason}\n`);
  }
}
