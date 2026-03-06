// This component renders identifier insights for the selected run.
interface InsightsViewProps {
  identifiers: Array<[string, number]>;
}

export function InsightsView({ identifiers }: InsightsViewProps): JSX.Element {
  if (identifiers.length === 0) {
    return (
      <section className="card insights-card">
        <h3 className="section-title">Identifier Insights</h3>
        <div className="meta">No identifiers available for the selected run.</div>
      </section>
    );
  }

  const totalIssues = identifiers.reduce((total, [, count]) => total + count, 0);
  const uniqueIdentifiers = identifiers.length;
  const topIdentifier: [string, number] = identifiers[0] ?? ["unknown", 0];
  const unknownEntry = identifiers.find(([identifier]) => identifier === "unknown");
  const unknownCount = unknownEntry?.[1] ?? 0;
  const knownCoverage = totalIssues > 0 ? Math.round(((totalIssues - unknownCount) / totalIssues) * 100) : 0;
  const maxCount = Math.max(...identifiers.map(([, count]) => count), 1);

  const donutEntries = identifiers.slice(0, 5);
  const donutTotal = donutEntries.reduce((total, [, count]) => total + count, 0);
  const donutRadius = 44;
  const donutCircumference = 2 * Math.PI * donutRadius;
  let donutOffset = 0;

  const donutSegments = donutEntries.map(([identifier, count], index) => {
    const ratio = donutTotal > 0 ? count / donutTotal : 0;
    const length = ratio * donutCircumference;
    const segment = {
      key: identifier,
      colorClass: `insights-donut-segment-${index % 5}`,
      dashArray: `${length} ${donutCircumference - length}`,
      dashOffset: -donutOffset
    };

    donutOffset += length;
    return segment;
  });

  return (
    <section className="card insights-card">
      <h3 className="section-title">Identifier Insights</h3>
      <div className="insights-kpis">
        <article className="insights-kpi-card">
          <div className="insights-kpi-label">Total Issues</div>
          <div className="insights-kpi-value">{totalIssues}</div>
        </article>
        <article className="insights-kpi-card">
          <div className="insights-kpi-label">Unique Identifiers</div>
          <div className="insights-kpi-value">{uniqueIdentifiers}</div>
        </article>
        <article className="insights-kpi-card">
          <div className="insights-kpi-label">Top Identifier</div>
          <div className="insights-kpi-value insights-kpi-value-small">{topIdentifier[0]}</div>
          <div className="insights-kpi-subvalue">{topIdentifier[1]} issues</div>
        </article>
        <article className="insights-kpi-card">
          <div className="insights-kpi-label">Known Coverage</div>
          <div className="insights-kpi-value">{knownCoverage}%</div>
          <div className="insights-kpi-subvalue">unknown: {unknownCount}</div>
        </article>
      </div>

      <div className="insights-visuals">
        <div className="insights-chart-card">
          <h4 className="insights-chart-title">Identifier Distribution</h4>
          <div className="insights-bars">
            {identifiers.map(([identifier, count]) => (
              <div key={identifier} className="insights-bar-row">
                <div className="insights-bar-head">
                  <span className="insights-bar-name">{identifier}</span>
                  <span className="insights-bar-count">{count}</span>
                </div>
                <div className="insights-bar-track">
                  <div
                    className="insights-bar-fill"
                    style={{ width: `${Math.max((count / maxCount) * 100, 4)}%` }}
                    aria-hidden="true"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="insights-chart-card insights-chart-card-compact">
          <h4 className="insights-chart-title">Top 5 Share</h4>
          <div className="insights-donut-wrap">
            <svg className="insights-donut" viewBox="0 0 120 120" role="img" aria-label="Top identifier share">
              <circle className="insights-donut-track" cx="60" cy="60" r={donutRadius} />
              {donutSegments.map((segment) => (
                <circle
                  key={segment.key}
                  className={`insights-donut-segment ${segment.colorClass}`}
                  cx="60"
                  cy="60"
                  r={donutRadius}
                  strokeDasharray={segment.dashArray}
                  strokeDashoffset={segment.dashOffset}
                />
              ))}
            </svg>
            <div className="insights-donut-center">
              <div className="insights-donut-total">{donutTotal}</div>
              <div className="insights-donut-label">issues</div>
            </div>
          </div>
          <div className="insights-legend">
            {donutEntries.map(([identifier, count], index) => (
              <div key={identifier} className="insights-legend-item">
                <span className={`insights-legend-dot insights-donut-segment-${index % 5}`} aria-hidden="true" />
                <span className="insights-legend-name">{identifier}</span>
                <span className="insights-legend-count">{count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="insights-links">
        {identifiers.map(([identifier, count]) => (
          <div key={identifier} className="identifier-row">
            <strong>{identifier}</strong> - {count}
            {identifier !== "unknown" && (
              <>
                {" "}
                <a href={`https://phpstan.org/error-identifiers/${identifier}`} target="_blank" rel="noreferrer">
                  docs
                </a>
              </>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
