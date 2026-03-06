// This hook encapsulates AI assistance loading, caching, deduplication, and cancellation.
import { useEffect, useRef, useState, type MutableRefObject } from "react";
import type { AiExplainResponse, AiSuggestFixResponse, RunIssue } from "../types.js";
import { buildAiRequestKey, getCachedValueWithLru, setCachedValueWithLru } from "../ai-request-context.js";
import { formatError, getIssueContextKey } from "../utils/app-helpers.js";

interface UseAiAssistanceOptions {
  apiBase: string;
  isLlmAvailable: boolean | null;
  aiContextIssue: RunIssue | null;
  activeSourceSnippet?: string;
}

interface UseAiAssistanceResult {
  aiExplain: AiExplainResponse | null;
  aiSuggestFix: AiSuggestFixResponse | null;
  isAiLoading: boolean;
  aiError: string | null;
}

type AiAssistanceCacheEntry = {
  explain: AiExplainResponse;
  suggestFix: AiSuggestFixResponse;
};

export function useAiAssistance({
  apiBase,
  isLlmAvailable,
  aiContextIssue,
  activeSourceSnippet
}: UseAiAssistanceOptions): UseAiAssistanceResult {
  const [aiExplain, setAiExplain] = useState<AiExplainResponse | null>(null);
  const [aiSuggestFix, setAiSuggestFix] = useState<AiSuggestFixResponse | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const aiRequestCacheRef = useRef<Map<string, AiAssistanceCacheEntry>>(new Map());
  const aiRequestInFlightKeyRef = useRef<string | null>(null);
  const aiRequestAbortRef = useRef<AbortController | null>(null);
  const aiVisibleIssueContextRef = useRef<string | null>(null);

  useEffect(() => {
    if (!aiContextIssue) {
      aiRequestAbortRef.current?.abort();
      aiRequestInFlightKeyRef.current = null;
      aiVisibleIssueContextRef.current = null;
      setAiExplain(null);
      setAiSuggestFix(null);
      setAiError(null);
      setIsAiLoading(false);
      return;
    }

    const nextIssueContextKey = getIssueContextKey(aiContextIssue);
    const didIssueContextChange = aiVisibleIssueContextRef.current !== nextIssueContextKey;

    if (isLlmAvailable !== true) {
      aiRequestAbortRef.current?.abort();
      aiRequestInFlightKeyRef.current = null;
      setIsAiLoading(false);

      if (didIssueContextChange) {
        setAiExplain(null);
        setAiSuggestFix(null);
      }

      setAiError(isLlmAvailable === false ? "LLM is currently unavailable" : null);
      aiVisibleIssueContextRef.current = nextIssueContextKey;
      return;
    }

    if (didIssueContextChange) {
      aiRequestAbortRef.current?.abort();
      aiRequestInFlightKeyRef.current = null;
      setAiExplain(null);
      setAiSuggestFix(null);
      setAiError(null);
      aiVisibleIssueContextRef.current = nextIssueContextKey;
    }

    void loadAiAssistance({
      apiBase,
      issue: aiContextIssue,
      sourceSnippet: activeSourceSnippet,
      setAiExplain,
      setAiSuggestFix,
      setAiError,
      setIsAiLoading,
      aiRequestCacheRef,
      aiRequestInFlightKeyRef,
      aiRequestAbortRef,
      aiVisibleIssueContextRef,
      expectedIssueContextKey: nextIssueContextKey
    });
  }, [
    aiContextIssue?.file,
    aiContextIssue?.line,
    aiContextIssue?.message,
    aiContextIssue?.identifier,
    activeSourceSnippet,
    isLlmAvailable,
    apiBase
  ]);

  useEffect(() => {
    return () => {
      aiRequestAbortRef.current?.abort();
    };
  }, []);

  return {
    aiExplain,
    aiSuggestFix,
    isAiLoading,
    aiError
  };
}

async function loadAiAssistance({
  apiBase,
  issue,
  sourceSnippet,
  setAiExplain,
  setAiSuggestFix,
  setAiError,
  setIsAiLoading,
  aiRequestCacheRef,
  aiRequestInFlightKeyRef,
  aiRequestAbortRef,
  aiVisibleIssueContextRef,
  expectedIssueContextKey
}: {
  apiBase: string;
  issue: RunIssue;
  sourceSnippet?: string;
  setAiExplain: (value: AiExplainResponse | null) => void;
  setAiSuggestFix: (value: AiSuggestFixResponse | null) => void;
  setAiError: (value: string | null) => void;
  setIsAiLoading: (value: boolean) => void;
  aiRequestCacheRef: MutableRefObject<Map<string, AiAssistanceCacheEntry>>;
  aiRequestInFlightKeyRef: MutableRefObject<string | null>;
  aiRequestAbortRef: MutableRefObject<AbortController | null>;
  aiVisibleIssueContextRef: MutableRefObject<string | null>;
  expectedIssueContextKey: string;
}): Promise<void> {
  const requestKey = buildAiRequestKey(issue, sourceSnippet);

  // Always cancel previous context requests, even if the next result comes from cache.
  if (aiRequestInFlightKeyRef.current !== null && aiRequestInFlightKeyRef.current !== requestKey) {
    aiRequestAbortRef.current?.abort();
    aiRequestInFlightKeyRef.current = null;
  }

  const cachedResponse = getCachedValueWithLru<string, AiAssistanceCacheEntry>(aiRequestCacheRef.current, requestKey);
  const cachedHasDebugPayload = Boolean(cachedResponse?.explain.debug || cachedResponse?.suggestFix.debug);
  if (cachedResponse && cachedHasDebugPayload) {
    // Prevent stale cached payloads from being rendered after a rapid context switch.
    if (aiVisibleIssueContextRef.current !== expectedIssueContextKey) {
      return;
    }

    setAiExplain(cachedResponse.explain);
    setAiSuggestFix(cachedResponse.suggestFix);
    setAiError(null);
    setIsAiLoading(false);
    return;
  }

  if (aiRequestInFlightKeyRef.current === requestKey) {
    return;
  }

  aiRequestAbortRef.current?.abort();
  const abortController = new AbortController();
  aiRequestAbortRef.current = abortController;
  aiRequestInFlightKeyRef.current = requestKey;

  const payload = {
    issueMessage: issue.message,
    issueIdentifier: issue.identifier,
    filePath: issue.file,
    line: issue.line,
    sourceSnippet
  };

  setIsAiLoading(true);
  setAiError(null);

  try {
    const [explainResponse, suggestFixResponse] = await Promise.all([
      fetch(`${apiBase}/api/ai/explain`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: abortController.signal
      }),
      fetch(`${apiBase}/api/ai/suggest-fix`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: abortController.signal
      })
    ]);

    if (!explainResponse.ok || !suggestFixResponse.ok) {
      throw new Error("Cannot load AI assistance");
    }

    const explainData = (await explainResponse.json()) as AiExplainResponse;
    const suggestFixData = (await suggestFixResponse.json()) as AiSuggestFixResponse;

    if (abortController.signal.aborted) {
      return;
    }

    // Ignore late responses that no longer match the currently visible issue context.
    if (aiVisibleIssueContextRef.current !== expectedIssueContextKey) {
      return;
    }

    setCachedValueWithLru(aiRequestCacheRef.current, requestKey, {
      explain: explainData,
      suggestFix: suggestFixData
    });

    setAiExplain(explainData);
    setAiSuggestFix(suggestFixData);
  } catch (unknownError) {
    if (abortController.signal.aborted) {
      return;
    }

    setAiExplain(null);
    setAiSuggestFix(null);
    setAiError(formatError(unknownError));
  } finally {
    if (aiRequestInFlightKeyRef.current === requestKey) {
      aiRequestInFlightKeyRef.current = null;
    }

    if (!abortController.signal.aborted) {
      setIsAiLoading(false);
    }
  }
}
