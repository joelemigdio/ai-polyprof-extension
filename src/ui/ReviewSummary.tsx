interface ReviewSummaryProps {
  summary: string | null;
}

export function ReviewSummary({ summary }: ReviewSummaryProps) {
  return (
    <section className="details-section" aria-labelledby="summary-heading">
      <h2 id="summary-heading">Review Summary</h2>
      {summary ? <p className="summary-copy">{summary}</p> : <p className="empty-state">No reviews are available to summarize.</p>}
      <p className="demo-disclosure">Deterministic demo summary based on mock review data — not AI-generated.</p>
    </section>
  );
}
