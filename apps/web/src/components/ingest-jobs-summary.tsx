import type { AiIngestJobPayload } from "../types.js";
import type { IngestStatusFilter } from "../hooks/use-ai-ingest.js";

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
            <li key={job.jobId}>
              <span>
                <strong>{job.status}</strong> <code>{job.targetPath}</code>
              </span>
              <span className="ai-meta">
                {job.stats ? `files=${job.stats.filesIndexed} chunks=${job.stats.chunksIndexed}` : "pending stats"}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
