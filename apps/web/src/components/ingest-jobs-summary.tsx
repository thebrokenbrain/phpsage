import type { AiIngestJobPayload } from "../types.js";
import type { IngestStatusFilter } from "../hooks/use-ai-ingest.js";
import { useState } from "react";

interface IngestJobsSummaryProps {
  recentIngestJobs: AiIngestJobPayload[];
  ingestStatusFilter: IngestStatusFilter;
  ingestListLoading: boolean;
  onIngestStatusFilterChange: (status: IngestStatusFilter) => void;
  refreshRecentIngestJobs: () => Promise<void>;
}

export function IngestJobsSummary({
  recentIngestJobs,
  ingestStatusFilter,
  ingestListLoading,
  onIngestStatusFilterChange,
  refreshRecentIngestJobs
}: IngestJobsSummaryProps): JSX.Element {
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null);

  function formatTimestamp(value: string | null): string {
    if (!value) {
      return "-";
    }

    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString();
  }

  return (
    <section className="ingest-summary">
      <div className="ingest-summary-header">
        <h3>Recent Ingest Jobs</h3>
        <div className="ingest-summary-controls">
          <label>
            Status
            <select
              value={ingestStatusFilter}
              onChange={(event) => onIngestStatusFilterChange(event.currentTarget.value as IngestStatusFilter)}
              disabled={ingestListLoading}
            >
              <option value="all">all</option>
              <option value="queued">queued</option>
              <option value="running">running</option>
              <option value="completed">completed</option>
              <option value="failed">failed</option>
            </select>
          </label>
          <button onClick={() => void refreshRecentIngestJobs()} disabled={ingestListLoading}>
            {ingestListLoading ? "Refreshing..." : "Refresh ingest jobs"}
          </button>
        </div>
      </div>

      {recentIngestJobs.length === 0 ? <p className="empty">No ingest jobs yet.</p> : null}

      {recentIngestJobs.length > 0 ? (
        <ul className="ingest-summary-list">
          {recentIngestJobs.map((job) => (
            <li key={job.jobId} className="ingest-job-row">
              <button
                className="ingest-job-toggle"
                onClick={() => {
                  setExpandedJobId((current) => current === job.jobId ? null : job.jobId);
                }}
              >
                <span>
                  <strong>{job.status}</strong> <code>{job.targetPath}</code>
                </span>
                <span className="ai-meta">
                  {job.stats ? `files=${job.stats.filesIndexed} chunks=${job.stats.chunksIndexed}` : "pending stats"}
                </span>
              </button>

              {expandedJobId === job.jobId ? (
                <div className="ingest-job-detail">
                  <p><strong>Job ID:</strong> <code>{job.jobId}</code></p>
                  <p><strong>Created:</strong> {formatTimestamp(job.createdAt)}</p>
                  <p><strong>Started:</strong> {formatTimestamp(job.startedAt)}</p>
                  <p><strong>Finished:</strong> {formatTimestamp(job.finishedAt)}</p>
                  <p><strong>Updated:</strong> {formatTimestamp(job.updatedAt)}</p>
                  {job.error ? <p className="error"><strong>Error:</strong> {job.error}</p> : null}
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
