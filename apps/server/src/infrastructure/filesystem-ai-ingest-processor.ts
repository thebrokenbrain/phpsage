// This file implements filesystem-based ingest by indexing file/chunk counts.

import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import type { AiIngestProcessor } from "../ports/ai-ingest-processor.js";
import type { AiIngestStats } from "../ports/ai-ingest-job-repository.js";

const IGNORED_DIRECTORIES = new Set([".git", "node_modules", "dist", "coverage", "data"]);
const MAX_FILE_SIZE_BYTES = 512_000;
const LINES_PER_CHUNK = 120;

export class FilesystemAiIngestProcessor implements AiIngestProcessor {
  public async ingest(targetPath: string): Promise<AiIngestStats> {
    return this.walk(targetPath);
  }

  private async walk(path: string): Promise<AiIngestStats> {
    const entryStats = await stat(path);

    if (entryStats.isDirectory()) {
      const entries = await readdir(path, { withFileTypes: true });
      let filesIndexed = 0;
      let chunksIndexed = 0;

      for (const entry of entries) {
        if (entry.isDirectory() && IGNORED_DIRECTORIES.has(entry.name)) {
          continue;
        }

        const child = await this.walk(join(path, entry.name));
        filesIndexed += child.filesIndexed;
        chunksIndexed += child.chunksIndexed;
      }

      return { filesIndexed, chunksIndexed };
    }

    if (!entryStats.isFile() || entryStats.size > MAX_FILE_SIZE_BYTES) {
      return { filesIndexed: 0, chunksIndexed: 0 };
    }

    const content = await readFile(path, "utf-8");
    const lineCount = content.split(/\r?\n/).length;

    return {
      filesIndexed: 1,
      chunksIndexed: Math.max(1, Math.ceil(lineCount / LINES_PER_CHUNK))
    };
  }
}
