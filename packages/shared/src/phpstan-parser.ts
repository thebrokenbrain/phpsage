// This file provides pure parsing helpers for PHPStan JSON output.
export interface ParsedPhpstanIssue {
  readonly file: string;
  readonly line: number;
  readonly message: string;
  readonly identifier?: string;
}

interface PhpstanMessage {
  readonly line?: number;
  readonly message?: string;
  readonly identifier?: string;
}

interface PhpstanFileResult {
  readonly messages?: PhpstanMessage[];
}

interface PhpstanAnalysisResult {
  readonly files?: Record<string, PhpstanFileResult>;
}

export function parsePhpstanJsonOutput(rawOutput: string): ParsedPhpstanIssue[] {
  const trimmed = rawOutput.trim();
  if (!trimmed) {
    return [];
  }

  const parsed = safeJsonParse(trimmed);
  if (!parsed || typeof parsed !== "object") {
    return [];
  }

  const analysisResult = parsed as PhpstanAnalysisResult;
  const files = analysisResult.files;
  if (!files || typeof files !== "object") {
    return [];
  }

  const issues: ParsedPhpstanIssue[] = [];
  for (const [file, result] of Object.entries(files)) {
    const messages = result.messages;
    if (!Array.isArray(messages)) {
      continue;
    }

    for (const message of messages) {
      if (!message || typeof message.message !== "string") {
        continue;
      }

      issues.push({
        file,
        line: typeof message.line === "number" ? message.line : 1,
        message: message.message,
        identifier: typeof message.identifier === "string" ? message.identifier : undefined
      });
    }
  }

  return issues;
}

function safeJsonParse(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}
