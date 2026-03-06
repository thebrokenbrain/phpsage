import type { AiIngestJobPayload } from "../types.js";

interface IngestJobsSummaryProps {
  recentIngestJobs: AiIngestJobPayload[];
  ingestListLoading: boolean;
  refreshRecentIngestJobs: () => Promise<void>;
}

export function IngestJobsSummary({
  recentIngestJobs,
  ingestListLoading,
  refreshRecentIngestJobs
}: IngestJobsSummaryProps): JSX.Element {
  return (
    <section className="ingest-summary">
      <div className="ingest-summary-header">
        <h3>Recent Ingest Jobs</h3>
        <button onClick={() => void refreshRecentIngestJobs()} disabled={ingestListLoading}>
          {ingestListLoading ? "Refreshing..." : "Refresh ingest jobs"}
        </button>
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
