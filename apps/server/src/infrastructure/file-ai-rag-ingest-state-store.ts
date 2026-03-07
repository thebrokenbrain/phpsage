// This file persists corpus fingerprints to skip unchanged Qdrant reindex work.

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { AiIngestStats } from "../ports/ai-ingest-job-repository.js";

interface AiRagIngestStateEntry {
  fingerprint: string;
  stats: AiIngestStats;
  updatedAt: string;
}

type AiRagIngestStatePayload = Record<string, AiRagIngestStateEntry>;

export class FileAiRagIngestStateStore {
  public constructor(private readonly filePath: string) {}

  public async get(key: string): Promise<AiRagIngestStateEntry | null> {
    const payload = await this.readPayload();
    return payload[key] ?? null;
  }

  public async save(key: string, entry: AiRagIngestStateEntry): Promise<void> {
    const payload = await this.readPayload();
    payload[key] = entry;

    await mkdir(dirname(this.filePath), { recursive: true });
    await writeFile(this.filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf-8");
  }

  private async readPayload(): Promise<AiRagIngestStatePayload> {
    try {
      const content = await readFile(this.filePath, "utf-8");
      return JSON.parse(content) as AiRagIngestStatePayload;
    } catch {
      return {};
    }
  }
}