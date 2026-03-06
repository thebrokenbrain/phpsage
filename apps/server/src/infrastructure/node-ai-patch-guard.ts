import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { spawn } from "node:child_process";
import type { AiPatchGuard, AiPatchGuardInput, AiPatchGuardResult } from "../ports/ai-patch-guard.js";

interface ParsedDiff {
  readonly headerPath: string;
  readonly hunks: Array<{
    readonly oldStart: number;
    readonly lines: string[];
  }>;
}

export class NodeAiPatchGuard implements AiPatchGuard {
  public async validate(input: AiPatchGuardInput): Promise<AiPatchGuardResult> {
    const normalizedDiff = input.proposedDiff.replace(/\r\n/g, "\n").trim();

    if (!normalizedDiff.startsWith("--- ") || !normalizedDiff.includes("\n+++ ") || !normalizedDiff.includes("\n@@")) {
      return { accepted: false, rejectedReason: "Patch must be a unified diff with ---/+++/@@ headers" };
    }

    if (this.hasSuspiciousContent(normalizedDiff)) {
      return { accepted: false, rejectedReason: "Patch contains suspicious content and was discarded" };
    }

    if (!input.filePath) {
      return { accepted: false, rejectedReason: "filePath is required to validate patch guardrails" };
    }

    let originalContent = "";
    try {
      originalContent = await readFile(input.filePath, "utf8");
    } catch {
      return { accepted: false, rejectedReason: "Cannot read target file for patch validation" };
    }

    let reconstructedContent = "";
    try {
      const parsedDiff = this.parseUnifiedDiff(normalizedDiff);
      const normalizedHeaderPath = this.normalizePath(parsedDiff.headerPath);
      const normalizedFilePath = this.normalizePath(input.filePath);
      if (normalizedHeaderPath !== normalizedFilePath) {
        return { accepted: false, rejectedReason: "Patch targets a different file than the reported issue" };
      }

      reconstructedContent = this.applyUnifiedDiff(originalContent, parsedDiff);
    } catch (error) {
      return {
        accepted: false,
        rejectedReason: error instanceof Error ? error.message : "Patch could not be reconstructed"
      };
    }

    const lintResult = await this.runPhpLint(reconstructedContent, input.filePath);
    if (!lintResult.ok) {
      return { accepted: false, rejectedReason: `php -l failed: ${lintResult.errorMessage}` };
    }

    return { accepted: true, rejectedReason: null };
  }

  private hasSuspiciousContent(diff: string): boolean {
    if (diff.length > 40_000 || diff.includes("\u0000")) {
      return true;
    }

    const suspiciousPatterns = [
      /rm\s+-rf/i,
      /\bcurl\s+https?:\/\//i,
      /\bwget\s+https?:\/\//i,
      /\bshell_exec\s*\(/i,
      /\bproc_open\s*\(/i,
      /\bpassthru\s*\(/i,
      /\beval\s*\(/i
    ];

    return suspiciousPatterns.some((pattern) => pattern.test(diff));
  }

  private parseUnifiedDiff(diff: string): ParsedDiff {
    const lines = diff.split("\n");
    const firstHeaderIndex = lines.findIndex((line) => line.startsWith("--- "));
    if (firstHeaderIndex < 0 || firstHeaderIndex + 1 >= lines.length || !lines[firstHeaderIndex + 1].startsWith("+++ ")) {
      throw new Error("Patch headers are invalid");
    }

    const additionalHeaders = lines.slice(firstHeaderIndex + 2).filter((line) => line.startsWith("--- ") || line.startsWith("+++ "));
    if (additionalHeaders.length > 0) {
      throw new Error("Patch must target a single file");
    }

    const oldHeader = lines[firstHeaderIndex].slice(4).trim();
    const newHeader = lines[firstHeaderIndex + 1].slice(4).trim();
    const headerPath = newHeader.startsWith("b/") ? newHeader.slice(2) : newHeader;
    const oldPath = oldHeader.startsWith("a/") ? oldHeader.slice(2) : oldHeader;
    if (this.normalizePath(headerPath) !== this.normalizePath(oldPath)) {
      throw new Error("Patch old/new headers point to different files");
    }

    const hunks: ParsedDiff["hunks"] = [];
    let cursor = firstHeaderIndex + 2;
    while (cursor < lines.length) {
      const line = lines[cursor];
      if (!line.startsWith("@@")) {
        cursor += 1;
        continue;
      }

      const match = line.match(/^@@\s+-(\d+)(?:,(\d+))?\s+\+(\d+)(?:,(\d+))?\s+@@/);
      if (!match) {
        throw new Error("Invalid hunk header");
      }

      const oldStart = Number.parseInt(match[1], 10);
      const hunkLines: string[] = [];
      cursor += 1;
      while (cursor < lines.length && !lines[cursor].startsWith("@@")) {
        const hunkLine = lines[cursor];
        if (hunkLine === "\\ No newline at end of file") {
          cursor += 1;
          continue;
        }

        const prefix = hunkLine[0];
        if (prefix !== " " && prefix !== "+" && prefix !== "-") {
          throw new Error("Invalid hunk body line prefix");
        }

        hunkLines.push(hunkLine);
        cursor += 1;
      }

      if (hunkLines.length === 0) {
        throw new Error("Patch hunk cannot be empty");
      }

      hunks.push({ oldStart, lines: hunkLines });
    }

    if (hunks.length === 0) {
      throw new Error("Patch has no hunks");
    }

    return { headerPath, hunks };
  }

  private applyUnifiedDiff(originalContent: string, parsedDiff: ParsedDiff): string {
    const normalizedOriginal = originalContent.replace(/\r\n/g, "\n");
    const hadTrailingNewline = normalizedOriginal.endsWith("\n");
    const originalLines = normalizedOriginal.split("\n");
    if (hadTrailingNewline) {
      originalLines.pop();
    }

    const output: string[] = [];
    let cursor = 0;

    for (const hunk of parsedDiff.hunks) {
      const hunkStart = Math.max(hunk.oldStart - 1, 0);
      if (hunkStart < cursor) {
        throw new Error("Patch hunk order is invalid");
      }

      output.push(...originalLines.slice(cursor, hunkStart));
      let originalIndex = hunkStart;

      for (const hunkLine of hunk.lines) {
        const prefix = hunkLine[0];
        const lineValue = hunkLine.slice(1);

        if (prefix === " ") {
          if (originalLines[originalIndex] !== lineValue) {
            throw new Error("Patch context does not match file content");
          }

          output.push(lineValue);
          originalIndex += 1;
          continue;
        }

        if (prefix === "-") {
          if (originalLines[originalIndex] !== lineValue) {
            throw new Error("Patch deletion does not match file content");
          }

          originalIndex += 1;
          continue;
        }

        output.push(lineValue);
      }

      cursor = originalIndex;
    }

    output.push(...originalLines.slice(cursor));
    const rebuilt = output.join("\n");
    return hadTrailingNewline ? `${rebuilt}\n` : rebuilt;
  }

  private async runPhpLint(content: string, filePath: string): Promise<{ ok: boolean; errorMessage: string }> {
    const tempDirectory = await mkdtemp(join(tmpdir(), "phpsage-lint-"));
    const tempFilePath = join(tempDirectory, basename(filePath) || "lint-target.php");

    try {
      await writeFile(tempFilePath, content, "utf8");
      for (const phpBinary of ["php", "php83"]) {
        const result = await this.runPhpLintWithBinary(phpBinary, tempFilePath);
        if (result.executed && result.ok) {
          return result;
        }

        if (result.executed && !result.ok) {
          return result;
        }
      }

      return { ok: false, errorMessage: "Neither php nor php83 is available for php -l validation" };
    } finally {
      await rm(tempDirectory, { recursive: true, force: true });
    }
  }

  private runPhpLintWithBinary(
    phpBinary: string,
    filePath: string
  ): Promise<{ executed: boolean; ok: boolean; errorMessage: string }> {
    return new Promise((resolve) => {
      const child = spawn(phpBinary, ["-l", filePath]);
      let stdout = "";
      let stderr = "";

      child.stdout.on("data", (chunk: Buffer | string) => {
        stdout += chunk.toString();
      });

      child.stderr.on("data", (chunk: Buffer | string) => {
        stderr += chunk.toString();
      });

      child.on("error", (error: NodeJS.ErrnoException) => {
        if (error.code === "ENOENT") {
          resolve({ executed: false, ok: false, errorMessage: `${phpBinary} not found` });
          return;
        }

        resolve({ executed: true, ok: false, errorMessage: error.message });
      });

      child.on("close", (code) => {
        const output = `${stdout}\n${stderr}`.trim();
        if (code === 0) {
          resolve({ executed: true, ok: true, errorMessage: "" });
          return;
        }

        resolve({ executed: true, ok: false, errorMessage: output || `${phpBinary} -l failed with code ${code ?? -1}` });
      });
    });
  }

  private normalizePath(filePath: string): string {
    return filePath.replace(/^\/+/, "").replace(/^a\//, "").replace(/^b\//, "");
  }
}
