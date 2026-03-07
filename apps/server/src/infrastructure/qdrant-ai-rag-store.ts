// This file implements a lightweight Qdrant-backed RAG store for PHPStan documentation context.

import { createHash } from "node:crypto";
import { readdir, readFile, stat } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import type { AiIngestStats } from "../ports/ai-ingest-job-repository.js";
import type { AiIngestProgressReporter } from "../ports/ai-ingest-processor.js";
import type { AiRagContextItem, AiRagRetrieveRequest, AiRagRetriever } from "../ports/ai-rag-retriever.js";
import type { FileAiRagIngestStateStore } from "./file-ai-rag-ingest-state-store.js";

interface QdrantPoint {
  id: number;
  vector: number[];
  payload: {
    path: string;
    identifier: string | null;
    content: string;
  };
}

interface QdrantSearchResult {
  score?: number;
  payload?: {
    path?: string;
    identifier?: string | null;
    content?: string;
  };
}

const DEFAULT_VECTOR_SIZE = 256;
const MAX_FILE_SIZE_BYTES = 512_000;
const IGNORED_DIRECTORIES = new Set([".git", "node_modules", "dist", "coverage", "data"]);
const UPSERT_BATCH_SIZE = 32;

export class QdrantAiRagStore implements AiRagRetriever {
  private collectionEnsured = false;

  public constructor(
    private readonly baseUrl: string,
    private readonly collectionName: string,
    private readonly vectorSize: number = DEFAULT_VECTOR_SIZE,
    private readonly defaultTopK: number = 3,
    private readonly ingestStateStore?: FileAiRagIngestStateStore
  ) {}

  public async ingestDirectory(targetPath: string, reportProgress?: AiIngestProgressReporter): Promise<AiIngestStats> {
    const absoluteTargetPath = resolve(targetPath);
    const filePaths = await this.collectMarkdownFiles(absoluteTargetPath);
    const documents = await Promise.all(filePaths.map(async (filePath) => {
      const content = await readFile(filePath, "utf-8");
      const chunks = chunkMarkdownContent(content);
      const relativePath = relative(absoluteTargetPath, filePath).replace(/\\/g, "/");

      return {
        relativePath,
        identifier: inferIdentifierFromPath(relativePath),
        chunks
      };
    }));
    documents.sort((left, right) => left.relativePath.localeCompare(right.relativePath));

    const fingerprint = buildCorpusFingerprint(documents);
    const stateKey = `${this.collectionName}::${absoluteTargetPath}`;
    const cachedState = await this.ingestStateStore?.get(stateKey);
    if (cachedState && cachedState.fingerprint === fingerprint) {
      await reportProgress?.(toProgressSnapshot(
        cachedState.stats.filesIndexed,
        cachedState.stats.filesIndexed,
        cachedState.stats.chunksIndexed,
        cachedState.stats.chunksIndexed
      ));
      return cachedState.stats;
    }

    await this.ensureCollection();

    const totalChunks = documents.reduce((sum, document) => sum + document.chunks.length, 0);
    let filesProcessed = 0;
    let chunksProcessed = 0;

    await reportProgress?.(toProgressSnapshot(filesProcessed, documents.length, chunksProcessed, totalChunks));

    for (const document of documents) {
      const points = document.chunks.map((chunk, index) => ({
        id: toStablePointId(`${document.relativePath}::${index}`),
        vector: textToVector(chunk, this.vectorSize),
        payload: {
          path: document.relativePath,
          identifier: document.identifier,
          content: chunk
        }
      }));

      for (let index = 0; index < points.length; index += UPSERT_BATCH_SIZE) {
        const batch = points.slice(index, index + UPSERT_BATCH_SIZE);
        if (batch.length === 0) {
          continue;
        }

        await this.upsertPoints(batch);
        chunksProcessed += batch.length;
        await reportProgress?.(toProgressSnapshot(filesProcessed, documents.length, chunksProcessed, totalChunks));
      }

      filesProcessed += 1;
      await reportProgress?.(toProgressSnapshot(filesProcessed, documents.length, chunksProcessed, totalChunks));
    }

    const stats = {
      filesIndexed: documents.length,
      chunksIndexed: totalChunks
    };

    await this.ingestStateStore?.save(stateKey, {
      fingerprint,
      stats,
      updatedAt: new Date().toISOString()
    });

    return stats;
  }

  public async retrieve(request: AiRagRetrieveRequest): Promise<AiRagContextItem[]> {
    await this.ensureCollection();

    const limit = Math.max(1, request.limit ?? this.defaultTopK);
    const queryText = [
      request.issueIdentifier ?? "",
      request.issueMessage,
      request.sourceSnippet ?? "",
      request.filePath ?? ""
    ]
      .filter((value) => value.trim().length > 0)
      .join("\n");

    if (!queryText.trim()) {
      return [];
    }

    const queryVector = textToVector(queryText, this.vectorSize);

    const prioritizedResults: QdrantSearchResult[] = [];

    if (request.issueIdentifier) {
      const exactIdentifierResults = await this.searchPoints({
        vector: queryVector,
        limit,
        with_payload: true,
        filter: {
          must: [
            {
              key: "identifier",
              match: { value: request.issueIdentifier }
            }
          ]
        }
      });

      prioritizedResults.push(...exactIdentifierResults);
    }

    if (prioritizedResults.length < limit) {
      const semanticResults = await this.searchPoints({
        vector: queryVector,
        limit: Math.max(limit * 2, 6),
        with_payload: true
      });

      prioritizedResults.push(...semanticResults);
    }

    const uniqueResults = deduplicateSearchResults(prioritizedResults).slice(0, limit);

    return uniqueResults
      .map((item) => ({
        sourcePath: item.payload?.path ?? "unknown",
        identifier: item.payload?.identifier ?? null,
        content: item.payload?.content ?? "",
        score: typeof item.score === "number" ? item.score : 0
      }))
      .filter((item) => item.content.length > 0);
  }

  private async searchPoints(body: Record<string, unknown>): Promise<QdrantSearchResult[]> {
    const response = await fetch(`${this.baseUrl.replace(/\/+$/, "")}/collections/${this.collectionName}/points/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      throw new Error(`Qdrant search failed (HTTP ${response.status})`);
    }

    const payload = (await response.json()) as { result?: QdrantSearchResult[] };
    return payload.result ?? [];
  }

  private async ensureCollection(): Promise<void> {
    if (this.collectionEnsured) {
      return;
    }

    const response = await fetch(`${this.baseUrl.replace(/\/+$/, "")}/collections/${this.collectionName}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        vectors: {
          size: this.vectorSize,
          distance: "Cosine"
        }
      })
    });

    if (!response.ok && response.status !== 409) {
      throw new Error(`Qdrant collection init failed (HTTP ${response.status})`);
    }

    this.collectionEnsured = true;
  }

  private async upsertPoints(points: QdrantPoint[]): Promise<void> {
    const response = await fetch(`${this.baseUrl.replace(/\/+$/, "")}/collections/${this.collectionName}/points?wait=true`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ points })
    });

    if (!response.ok) {
      throw new Error(`Qdrant upsert failed (HTTP ${response.status})`);
    }
  }

  private async collectMarkdownFiles(path: string): Promise<string[]> {
    const itemStats = await stat(path);
    if (itemStats.isFile()) {
      if (itemStats.size > MAX_FILE_SIZE_BYTES || !path.endsWith(".md")) {
        return [];
      }

      return [path];
    }

    if (!itemStats.isDirectory()) {
      return [];
    }

    const entries = await readdir(path, { withFileTypes: true });
    const files: string[] = [];

    entries.sort((left, right) => left.name.localeCompare(right.name));

    for (const entry of entries) {
      if (entry.isDirectory() && IGNORED_DIRECTORIES.has(entry.name)) {
        continue;
      }

      const childPath = join(path, entry.name);
      const nested = await this.collectMarkdownFiles(childPath);
      files.push(...nested);
    }

    return files;
  }
}

function buildCorpusFingerprint(documents: Array<{ relativePath: string; chunks: string[] }>): string {
  const hash = createHash("sha1");

  for (const document of documents) {
    hash.update(document.relativePath);
    hash.update("\u0000");

    for (const chunk of document.chunks) {
      hash.update(chunk);
      hash.update("\u0000");
    }
  }

  return hash.digest("hex");
}

function toProgressSnapshot(filesProcessed: number, filesTotal: number, chunksProcessed: number, chunksTotal: number) {
  const progressPercent = chunksTotal > 0
    ? Math.round((chunksProcessed / chunksTotal) * 100)
    : (filesTotal > 0 ? Math.round((filesProcessed / filesTotal) * 100) : 100);

  return {
    filesProcessed,
    filesTotal,
    chunksProcessed,
    chunksTotal,
    progressPercent: Math.min(100, Math.max(0, progressPercent))
  };
}

function chunkMarkdownContent(content: string): string[] {
  const sections = content
    .split(/\n{2,}/)
    .map((section) => section.trim())
    .filter((section) => section.length > 0);

  if (sections.length === 0) {
    return [];
  }

  const chunks: string[] = [];
  let currentChunk = "";

  for (const section of sections) {
    const nextCandidate = currentChunk.length > 0 ? `${currentChunk}\n\n${section}` : section;
    if (nextCandidate.length > 1000 && currentChunk.length > 0) {
      chunks.push(currentChunk);
      currentChunk = section;
      continue;
    }

    currentChunk = nextCandidate;
  }

  if (currentChunk.length > 0) {
    chunks.push(currentChunk);
  }

  return chunks;
}

function inferIdentifierFromPath(relativePath: string): string | null {
  const fileName = relativePath.split("/").pop() ?? "";
  const withoutExt = fileName.replace(/\.md$/i, "");
  const normalized = withoutExt.trim();
  return normalized.length > 0 ? normalized : null;
}

function textToVector(input: string, size: number): number[] {
  const vector = new Array<number>(size).fill(0);
  const tokens = tokenize(input);

  for (const token of tokens) {
    const index = hashToken(token) % size;
    vector[index] += 1;
  }

  const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
  if (norm === 0) {
    return vector;
  }

  return vector.map((value) => value / norm);
}

function tokenize(input: string): string[] {
  return input
    .toLowerCase()
    .split(/[^a-z0-9_\.]+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2);
}

function hashToken(token: string): number {
  let hash = 5381;
  for (let index = 0; index < token.length; index += 1) {
    hash = ((hash << 5) + hash + token.charCodeAt(index)) >>> 0;
  }

  return hash;
}

function toStablePointId(value: string): number {
  const digest = createHash("sha1").update(value).digest();
  return digest.readUInt32BE(0);
}

function deduplicateSearchResults(results: QdrantSearchResult[]): QdrantSearchResult[] {
  const deduplicated: QdrantSearchResult[] = [];
  const seenKeys = new Set<string>();

  for (const result of results) {
    const path = result.payload?.path ?? "unknown";
    const content = result.payload?.content ?? "";
    const key = `${path}::${content}`;

    if (seenKeys.has(key)) {
      continue;
    }

    seenKeys.add(key);
    deduplicated.push(result);
  }

  return deduplicated;
}
