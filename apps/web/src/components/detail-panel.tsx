import type { AiExplainPayload, AiSuggestFixPayload, RunFileItem, RunIssue, RunRecord, RunSummary, SourcePayload } from "../types.js";
import { AiAssistDetailBlock } from "./ai-assist-detail-block.js";
import { FilesDetailBlock } from "./files-detail-block.js";
import { IssuesDetailBlock } from "./issues-detail-block.js";
import { LogsDetailBlock } from "./logs-detail-block.js";
import { RunDetailMeta } from "./run-detail-meta.js";
import { SourceDetailBlock } from "./source-detail-block.js";

interface DetailPanelProps {
  detailLoading: boolean;
  detailError: string | null;
  selectedRun: RunRecord | null;
  copyRunIdStatus: "idle" | "copied" | "error";
  copyRunId: () => Promise<void>;
  isFilesSectionOpen: boolean;
  setIsFilesSectionOpen: (value: boolean | ((current: boolean) => boolean)) => void;
  selectedSourceFilePath: string | null;
  setSelectedSourceFilePath: (value: string | null | ((current: string | null) => string | null)) => void;
  fileSearchTerm: string;
  setFileSearchTerm: (value: string) => void;
  filesLoading: boolean;
  filesError: string | null;
  visibleRunFiles: RunFileItem[];
  runFiles: RunFileItem[];
  isIssuesSectionOpen: boolean;
  setIsIssuesSectionOpen: (value: boolean | ((current: boolean) => boolean)) => void;
  issueSearchTerm: string;
  setIssueSearchTerm: (value: string) => void;
  issueIdentifierFilter: "all" | "with" | "without";
  setIssueIdentifierFilter: (value: "all" | "with" | "without") => void;
  setIssuePage: (value: number | ((current: number) => number)) => void;
  filteredIssueEntries: Array<{ issue: RunIssue; absoluteIndex: number }>;
  issuePage: number;
  detailPageSize: number;
  selectedIssueIndex: number;
  setSelectedIssueIndex: (value: number | ((current: number) => number)) => void;
  isSourceSectionOpen: boolean;
  setIsSourceSectionOpen: (value: boolean | ((current: boolean) => boolean)) => void;
  sourceLoading: boolean;
  sourceError: string | null;
  sourcePayload: SourcePayload | null;
  activeIssueLineInSource: number | null;
  isLogsSectionOpen: boolean;
  setIsLogsSectionOpen: (value: boolean | ((current: boolean) => boolean)) => void;
  logSearchTerm: string;
  setLogSearchTerm: (value: string) => void;
  logStreamFilter: "all" | "stdout" | "stderr";
  setLogStreamFilter: (value: "all" | "stdout" | "stderr") => void;
  setLogPage: (value: number | ((current: number) => number)) => void;
  filteredLogs: RunRecord["logs"];
  logPage: number;
  activeIssue: RunIssue | null;
  isLlmAvailable: boolean | null;
  isAiLoading: boolean;
  aiError: string | null;
  aiExplain: AiExplainPayload | null;
  aiSuggestFix: AiSuggestFixPayload | null;
}

export function DetailPanel({
  detailLoading,
  detailError,
  selectedRun,
  copyRunIdStatus,
  copyRunId,
  isFilesSectionOpen,
  setIsFilesSectionOpen,
  selectedSourceFilePath,
  setSelectedSourceFilePath,
  fileSearchTerm,
  setFileSearchTerm,
  filesLoading,
  filesError,
  visibleRunFiles,
  runFiles,
  isIssuesSectionOpen,
  setIsIssuesSectionOpen,
  issueSearchTerm,
  setIssueSearchTerm,
  issueIdentifierFilter,
  setIssueIdentifierFilter,
  setIssuePage,
  filteredIssueEntries,
  issuePage,
  detailPageSize,
  selectedIssueIndex,
  setSelectedIssueIndex,
  isSourceSectionOpen,
  setIsSourceSectionOpen,
  sourceLoading,
  sourceError,
  sourcePayload,
  activeIssueLineInSource,
  isLogsSectionOpen,
  setIsLogsSectionOpen,
  logSearchTerm,
  setLogSearchTerm,
  logStreamFilter,
  setLogStreamFilter,
  setLogPage,
  filteredLogs,
  logPage,
  activeIssue,
  isLlmAvailable,
  isAiLoading,
  aiError,
  aiExplain,
  aiSuggestFix
}: DetailPanelProps): JSX.Element {
  return (
    <section className="detail-panel">
      <RunDetailMeta
        detailLoading={detailLoading}
        detailError={detailError}
        selectedRun={selectedRun}
        copyRunIdStatus={copyRunIdStatus}
        copyRunId={copyRunId}
      />

      {!detailLoading && !detailError && selectedRun ? (
        <>
          <FilesDetailBlock
            isFilesSectionOpen={isFilesSectionOpen}
            setIsFilesSectionOpen={setIsFilesSectionOpen}
            selectedSourceFilePath={selectedSourceFilePath}
            setSelectedSourceFilePath={setSelectedSourceFilePath}
            fileSearchTerm={fileSearchTerm}
            setFileSearchTerm={setFileSearchTerm}
            filesLoading={filesLoading}
            filesError={filesError}
            visibleRunFiles={visibleRunFiles}
            runFiles={runFiles}
            selectedRun={selectedRun}
          />

          <IssuesDetailBlock
            isIssuesSectionOpen={isIssuesSectionOpen}
            setIsIssuesSectionOpen={setIsIssuesSectionOpen}
            issueSearchTerm={issueSearchTerm}
            setIssueSearchTerm={setIssueSearchTerm}
            issueIdentifierFilter={issueIdentifierFilter}
            setIssueIdentifierFilter={setIssueIdentifierFilter}
            setIssuePage={setIssuePage}
            filteredIssueEntries={filteredIssueEntries}
            issuePage={issuePage}
            detailPageSize={detailPageSize}
            selectedIssueIndex={selectedIssueIndex}
            setSelectedIssueIndex={setSelectedIssueIndex}
            setSelectedSourceFilePath={setSelectedSourceFilePath}
            selectedRun={selectedRun}
          />

          <SourceDetailBlock
            isSourceSectionOpen={isSourceSectionOpen}
            setIsSourceSectionOpen={setIsSourceSectionOpen}
            sourceLoading={sourceLoading}
            sourceError={sourceError}
            sourcePayload={sourcePayload}
            activeIssueLineInSource={activeIssueLineInSource}
          />

          <LogsDetailBlock
            isLogsSectionOpen={isLogsSectionOpen}
            setIsLogsSectionOpen={setIsLogsSectionOpen}
            logSearchTerm={logSearchTerm}
            setLogSearchTerm={setLogSearchTerm}
            logStreamFilter={logStreamFilter}
            setLogStreamFilter={setLogStreamFilter}
            setLogPage={setLogPage}
            filteredLogs={filteredLogs}
            logPage={logPage}
            detailPageSize={detailPageSize}
            selectedRun={selectedRun}
          />

          <AiAssistDetailBlock
            activeIssue={activeIssue}
            isLlmAvailable={isLlmAvailable}
            isAiLoading={isAiLoading}
            aiError={aiError}
            aiExplain={aiExplain}
            aiSuggestFix={aiSuggestFix}
          />
        </>
      ) : null}
    </section>
  );
}