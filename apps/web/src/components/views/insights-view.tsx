// This component renders identifier insights for the selected run.
interface InsightsViewProps {
  identifiers: Array<[string, number]>;
}

export function InsightsView({ identifiers }: InsightsViewProps): JSX.Element {
  return (
    <section className="card">
      <h3 className="section-title">Identifier Insights</h3>
      {identifiers.length === 0 && <div className="meta">No identifiers available for the selected run.</div>}
      {identifiers.map(([identifier, count]) => (
        <div key={identifier} className="identifier-row">
          <strong>{identifier}</strong> — {count}
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
    </section>
  );
}
