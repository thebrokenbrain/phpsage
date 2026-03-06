import type { RunIssue } from "./types.js";

const AI_REQUEST_CACHE_MAX_SIZE = 50;

export function buildAiRequestKey(issue: RunIssue, sourceSnippet?: string): string {
  return `${issue.file}::${issue.line}::${issue.message}::${issue.identifier ?? "unknown"}::${sourceSnippet ?? ""}`;
}

// Returns cached value and refreshes its recency to keep LRU ordering stable.
export function getCachedValueWithLru<K, V>(cache: Map<K, V>, key: K): V | undefined {
  const value = cache.get(key);
  if (value === undefined) {
    return undefined;
  }

  cache.delete(key);
  cache.set(key, value);
  return value;
}

// Stores cache entry and evicts oldest entries if size exceeds configured max.
export function setCachedValueWithLru<K, V>(cache: Map<K, V>, key: K, value: V, maxSize = AI_REQUEST_CACHE_MAX_SIZE): void {
  if (cache.has(key)) {
    cache.delete(key);
  }

  cache.set(key, value);

  while (cache.size > maxSize) {
    const oldestKey = cache.keys().next().value as K | undefined;
    if (oldestKey === undefined) {
      break;
    }

    cache.delete(oldestKey);
  }
}
