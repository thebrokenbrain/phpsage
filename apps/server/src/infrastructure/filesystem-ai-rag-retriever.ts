// This file implements lightweight filesystem-based RAG retrieval over markdown corpus.

import { readdir, readFile, stat } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import type { AiRagContextItem, AiRagRetrieveRequest, AiRagRetriever } from "../ports/ai-rag-retriever.js";

const MAX_FILE_SIZE_BYTES = 512_000;
const MAX_CONTEXT_CHARS = 1200;
const IGNORED_DIRECTORIES = new Set([".git", "node_modules", "dist", "coverage", "data"]);

interface RagDocument {
  sourcePath: string;
  identifier: string | null;
  content: string;
}

export class FilesystemAiRagRetriever implements AiRagRetriever {
  public constructor(
    private readonly rootDirectoryPath: string,
    private readonly defaultTopK: number = 3
  ) {}

  public async retrieve(request: AiRagRetrieveRequest): Promise<AiRagContextItem[]> {
    const absoluteRoot = resolve(this.rootDirectoryPath);
    const files = await this.collectMarkdownFiles(absoluteRoot);

    const documents = await Promise.all(
      files.map(async (filePath) => {
        const content = await readFile(filePath, "utf-8");
        const sourcePath = relative(absoluteRoot, filePath).replace(/\\/g, "/");
        return {
          sourcePath,
          identifier: inferIdentifierFromPath(sourcePath),
          content: content.slice(0, MAX_CONTEXT_CHARS)
        } as RagDocument;
      })
    );

    const limit = Math.max(1, request.limit ?? this.defaultTopK);
    const scored = documents
      .map((document) => ({
        document,
        score: scoreDocument(request, document)
      }))
      .filter((item) => item.score > 0)
      .sort((left, right) => right.score - left.score)
      .slice(0, limit);

    return scored.map((item) => ({
      sourcePath: item.document.sourcePath,
      identifier: item.document.identifier,
      content: item.document.content,
      score: item.score
    }));
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

function inferIdentifierFromPath(path: string): string | null {
  const fileName = path.split("/").pop();
  if (!fileName) {
    return null;
  }

  return fileName.endsWith(".md") ? fileName.slice(0, -3) : null;
}

function scoreDocument(request: AiRagRetrieveRequest, document: RagDocument): number {
  let score = 0;

  const issueIdentifier = request.issueIdentifier?.trim().toLowerCase();
  const normalizedIdentifier = document.identifier?.toLowerCase();
  if (issueIdentifier && normalizedIdentifier === issueIdentifier) {
    score += 1000;
  } else if (issueIdentifier && normalizedIdentifier?.startsWith(issueIdentifier.split(".")[0] ?? "")) {
    score += 120;
  }

  const queryTokens = tokenize([
    request.issueMessage,
    request.issueIdentifier,
    request.filePath,
    request.sourceSnippet
  ]);
  if (queryTokens.size === 0) {
    return score;
  }

  const haystack = `${document.identifier ?? ""}\n${document.content}`.toLowerCase();
  for (const token of queryTokens) {
    if (token.length < 3) {
      continue;
    }

    if (haystack.includes(token)) {
      score += 1;
    }
  }

  return score;
}

function tokenize(values: Array<string | undefined>): Set<string> {
  const tokens = new Set<string>();

  for (const value of values) {
    if (!value) {
      continue;
    }

    for (const token of value.toLowerCase().split(/[^a-z0-9_\.]+/)) {
      if (token.length > 0) {
        tokens.add(token);
      }
    }
  }

  return tokens;
}
