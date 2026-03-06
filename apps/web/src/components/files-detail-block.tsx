import type { RunFileItem, RunRecord } from "../types.js";

interface FilesDetailBlockProps {
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
  selectedRun: RunRecord;
}

export function FilesDetailBlock({
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
  selectedRun
}: FilesDetailBlockProps): JSX.Element {
  return (
    <section className="detail-block">
      <div className="detail-block-header">
        <h3>Files</h3>
        <button
          onClick={() => {
            setIsFilesSectionOpen((isOpen) => !isOpen);
          }}
        >
          {isFilesSectionOpen ? "Hide" : "Show"}
        </button>
        <div className="detail-actions">
          {selectedSourceFilePath ? (
            <button
              onClick={() => {
                setSelectedSourceFilePath(null);
              }}
            >
              Use issue context
            </button>
          ) : null}
          <input
            type="search"
            placeholder="Filter files"
            value={fileSearchTerm}
            onChange={(event) => {
              setFileSearchTerm(event.target.value);
            }}
          />
        </div>
      </div>

      {isFilesSectionOpen ? (
        <>
          {filesLoading ? <p className="empty">Loading files...</p> : null}
          {filesError ? <p className="error">Could not load files: {filesError}</p> : null}

          {!filesLoading && !filesError && visibleRunFiles.length > 0 ? (
            <ul className="detail-list">
              {visibleRunFiles.slice(0, 30).map((fileEntry) => (
                <li
                  key={fileEntry.path}
                  className={selectedSourceFilePath === `${selectedRun.targetPath}/${fileEntry.path}` ? "selected-issue" : ""}
                  onClick={() => {
                    setSelectedSourceFilePath(`${selectedRun.targetPath}/${fileEntry.path}`);
                  }}
                >
                  <span className="mono">{fileEntry.path}</span>
                  {" — "}
                  issues: {fileEntry.issueCount}
                </li>
              ))}
            </ul>
          ) : null}

          {!filesLoading && !filesError && runFiles.length === 0 ? (
            <p className="empty">No PHP files for selected run.</p>
          ) : null}

          {!filesLoading && !filesError && runFiles.length > 0 && visibleRunFiles.length === 0 ? (
            <p className="empty">No files match current filter.</p>
          ) : null}
        </>
      ) : null}
    </section>
  );
}