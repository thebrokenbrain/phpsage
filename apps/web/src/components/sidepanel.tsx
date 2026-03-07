// This component renders the runs explorer and file tree, keeping App focused on orchestration.
import { AppIcon } from "./app-icon.js";
import type { RunSummary } from "../types.js";
import type { RunFileTreeRow } from "../utils/run-file-tree.js";

interface SidepanelProps {
  width: number;
  projectPath: string;
  runs: RunSummary[];
  selectedRunId: string | null;
  visibleFileTreeRows: RunFileTreeRow[];
  collapsedDirectories: Set<string>;
  selectedFilePath: string | null;
  deletingRunId: string | null;
  onSelectRun: (runId: string) => void;
  onDeleteRun: (runId: string) => void;
  onToggleDirectory: (path: string) => void;
  onSelectFile: (path: string) => void;
}

export function Sidepanel({
  width,
  projectPath,
  runs,
  selectedRunId,
  visibleFileTreeRows,
  collapsedDirectories,
  selectedFilePath,
  deletingRunId,
  onSelectRun,
  onDeleteRun,
  onToggleDirectory,
  onSelectFile
}: SidepanelProps) {
  return (
    <aside className="sidepanel" style={{ width: `${width}px` }}>
      <div className="sidepanel-header">
        <h2 className="section-title">Project Files</h2>
        <div className="project-name">{getProjectName(projectPath)}</div>
      </div>

      <h3 className="section-title">Runs</h3>
      <div className="item-list">
        {runs.map((run) => (
          <div key={run.runId} className={`run-item ${run.runId === selectedRunId ? "active" : ""}`}>
            <button
              type="button"
              className={`item-button ${run.runId === selectedRunId ? "active" : ""}`}
              onClick={() => onSelectRun(run.runId)}
            >
              <div className="run-head">
                <span className="run-title">{run.runId.slice(0, 8)}</span>
                <span className={`run-status ${run.status}`}>{run.status}</span>
              </div>
              <div className="run-path" title={run.targetPath}>{run.targetPath}</div>
            </button>
            <button
              type="button"
              className="run-delete-button"
              aria-label={`Delete run ${run.runId.slice(0, 8)}`}
              title="Delete run"
              disabled={deletingRunId === run.runId}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();

                if (!window.confirm(`Delete run ${run.runId.slice(0, 8)}?`)) {
                  return;
                }

                onDeleteRun(run.runId);
              }}
            >
              <AppIcon name="delete" />
            </button>
          </div>
        ))}
      </div>

      <h3 className="section-title files-title">Files</h3>
      {visibleFileTreeRows.length === 0 && <div className="meta">No files available for this run</div>}
      <div className="file-tree-list">
        {visibleFileTreeRows.map((row) => {
          if (row.type === "directory") {
            const isCollapsed = collapsedDirectories.has(row.path);
            return (
              <button
                key={row.key}
                className="file-tree-dir"
                style={{ paddingLeft: `${8 + row.depth * 12}px` }}
                onClick={() => onToggleDirectory(row.path)}
                title={isCollapsed ? "Expand directory" : "Collapse directory"}
              >
                <span className="file-tree-icon" aria-hidden="true">{isCollapsed ? "▸" : "▾"}</span>
                <span className="file-tree-label">{row.label}</span>
              </button>
            );
          }

          return (
            <button
              key={row.key}
              className={`file-tree-file ${selectedFilePath === row.path ? "active" : ""}`}
              style={{ paddingLeft: `${8 + row.depth * 12}px` }}
              onClick={() => onSelectFile(row.path)}
              title={row.path}
            >
              <span className="file-tree-icon" aria-hidden="true">•</span>
              <span className="file-tree-label">{row.label}</span>
              {row.hasIssues && <span className="file-tree-badge">{row.issueCount}</span>}
            </button>
          );
        })}
      </div>
    </aside>
  );
}

function getProjectName(targetPath: string): string {
  if (!targetPath) {
    return "no-target";
  }

  const normalized = targetPath.replace(/\\/g, "/");
  const parts = normalized.split("/").filter(Boolean);
  return parts[parts.length - 1] ?? targetPath;
}
