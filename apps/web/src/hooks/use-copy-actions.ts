import { useState } from "react";

interface UseCopyActionsOptions {
  selectedRunId: string | null;
}

interface UseCopyActionsResult {
  copyLinkStatus: "idle" | "copied" | "error";
  copyRunIdStatus: "idle" | "copied" | "error";
  copyCurrentDeepLink: () => Promise<void>;
  copyRunId: () => Promise<void>;
}

export function useCopyActions({ selectedRunId }: UseCopyActionsOptions): UseCopyActionsResult {
  const [copyLinkStatus, setCopyLinkStatus] = useState<"idle" | "copied" | "error">("idle");
  const [copyRunIdStatus, setCopyRunIdStatus] = useState<"idle" | "copied" | "error">("idle");

  async function copyCurrentDeepLink(): Promise<void> {
    if (typeof window === "undefined" || !window.navigator.clipboard) {
      setCopyLinkStatus("error");
      return;
    }

    try {
      await window.navigator.clipboard.writeText(window.location.href);
      setCopyLinkStatus("copied");
      window.setTimeout(() => {
        setCopyLinkStatus("idle");
      }, 1500);
    } catch {
      setCopyLinkStatus("error");
    }
  }

  async function copyRunId(): Promise<void> {
    if (typeof window === "undefined" || !window.navigator.clipboard || !selectedRunId) {
      setCopyRunIdStatus("error");
      return;
    }

    try {
      await window.navigator.clipboard.writeText(selectedRunId);
      setCopyRunIdStatus("copied");
      window.setTimeout(() => {
        setCopyRunIdStatus("idle");
      }, 1500);
    } catch {
      setCopyRunIdStatus("error");
    }
  }

  return {
    copyLinkStatus,
    copyRunIdStatus,
    copyCurrentDeepLink,
    copyRunId
  };
}