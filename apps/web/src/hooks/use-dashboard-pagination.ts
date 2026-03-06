import { useEffect } from "react";
import type { RunRecord } from "../types.js";

interface UseDashboardPaginationOptions {
  selectedRun: RunRecord | null;
  selectedIssueIndex: number;
  issuePage: number;
  setSelectedIssueIndex: (value: number | ((current: number) => number)) => void;
  setIssuePage: (value: number | ((current: number) => number)) => void;
  filteredIssueCount: number;
  filteredLogCount: number;
  logPage: number;
  setLogPage: (value: number | ((current: number) => number)) => void;
  detailPageSize: number;
}

export function useDashboardPagination({
  selectedRun,
  selectedIssueIndex,
  issuePage,
  setSelectedIssueIndex,
  setIssuePage,
  filteredIssueCount,
  filteredLogCount,
  logPage,
  setLogPage,
  detailPageSize
}: UseDashboardPaginationOptions): void {
  useEffect(() => {
    if (!selectedRun) {
      setIssuePage(0);
      return;
    }

    if (selectedRun.issues.length === 0) {
      setSelectedIssueIndex(0);
      setIssuePage(0);
      return;
    }

    const clampedIssueIndex = Math.min(Math.max(0, selectedIssueIndex), selectedRun.issues.length - 1);
    if (clampedIssueIndex !== selectedIssueIndex) {
      setSelectedIssueIndex(clampedIssueIndex);
      return;
    }

    const derivedIssuePage = Math.floor(clampedIssueIndex / detailPageSize);
    if (derivedIssuePage !== issuePage) {
      setIssuePage(derivedIssuePage);
    }
  }, [detailPageSize, issuePage, selectedIssueIndex, selectedRun, setIssuePage, setSelectedIssueIndex]);

  useEffect(() => {
    const maxIssuePage = Math.max(0, Math.ceil(filteredIssueCount / detailPageSize) - 1);
    if (issuePage > maxIssuePage) {
      setIssuePage(maxIssuePage);
    }
  }, [detailPageSize, filteredIssueCount, issuePage, setIssuePage]);

  useEffect(() => {
    if (filteredLogCount === 0) {
      if (logPage !== 0) {
        setLogPage(0);
      }
      return;
    }

    const maxLogPage = Math.max(0, Math.ceil(filteredLogCount / detailPageSize) - 1);
    const clampedLogPage = Math.min(Math.max(0, logPage), maxLogPage);
    if (clampedLogPage !== logPage) {
      setLogPage(clampedLogPage);
    }
  }, [detailPageSize, filteredLogCount, logPage, setLogPage]);
}