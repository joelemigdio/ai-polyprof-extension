import type { Professor } from "../models/professor";

interface ProfessorDetailsProps {
  professor: Professor;
  onBack: () => void;
}

export function ProfessorDetails({ professor, onBack }: ProfessorDetailsProps) {
  const traits = professor.ratingTraits ?? [];
  const reviews = professor.reviews ?? [];

  return (
    <section className="details-view" aria-label={`${professor.name} details`}>
      <button className="back-button" type="button" onClick={onBack}>
        ← Back to Results
      </button>

      <article className="details-card">
        <div className="card-heading">
          <div>
            <h2>{professor.name || "Professor details unavailable"}</h2>
            <p>{professor.department || "Department unavailable"}</p>
          </div>
          <div className="rating" aria-label={`${professor.overallRating ?? 0} out of 5 overall rating`}>
            <span aria-hidden="true">★</span> {(professor.overallRating ?? 0).toFixed(1)}
          </div>
        </div>
        <p className="review-count">{professor.reviewCount ?? reviews.length} demo reviews</p>
      </article>

      <section className="details-section" aria-labelledby="traits-heading">
        <h2 id="traits-heading">Rating traits</h2>
        {traits.length > 0 ? (
          <dl className="trait-scores">
            {traits.map((trait) => (
              <div key={trait.name}>
                <dt>{trait.name}</dt>
                <dd>{trait.score.toFixed(1)}<span aria-hidden="true"> / 5</span></dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="empty-state">No rating traits are available for this professor.</p>
        )}
      </section>

      <section className="details-section" aria-labelledby="reviews-heading">
        <h2 id="reviews-heading">Student reviews</h2>
        {reviews.length > 0 ? (
          <div className="review-list">
            {reviews.map((review) => (
              <article className="review-card" key={review.id}>
                <div className="review-heading">
                  <strong>{review.courseCode || "Course unavailable"}</strong>
                  <span aria-label={`${review.rating ?? 0} out of 5 review rating`}>★ {(review.rating ?? 0).toFixed(1)}</span>
                </div>
                <p>{review.text || "No review text was provided."}</p>
                {(review.tags ?? []).length > 0 ? (
                  <div className="traits" aria-label="Review tags">
                    {review.tags?.map((tag) => <span key={tag}>{tag}</span>)}
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        ) : (
          <p className="empty-state">No individual reviews are available for this professor.</p>
        )}
      </section>
    </section>
  );
}
