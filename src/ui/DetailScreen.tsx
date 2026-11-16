import { ratingScaleMax, type Professor } from "../models/professor";
import type { StudentPreferences } from "../models/preferences";
import { matchProfessor } from "../services/preference-matching";
import { synthesizeReviews } from "../services/review-synthesis";
import { ArrowLeftIcon, SparkleIcon, StarIcon } from "./Icons";
import { ProfessorCard } from "./ProfessorCard";

interface DetailScreenProps {
  professor: Professor;
  preferences: StudentPreferences;
  onBack: () => void;
}

export function DetailScreen({ professor, preferences, onBack }: DetailScreenProps) {
  const synthesis = synthesizeReviews(professor, professor.reviews);

  return (
    <div className="screen">
      <div className="scroll-area">
        <button className="back-button" type="button" onClick={onBack}>
          <ArrowLeftIcon size={16} />
          Back to results
        </button>

        <ProfessorCard professor={professor} match={matchProfessor(professor, preferences)} />

        <section className="reviews-card" aria-labelledby="synthesis-heading">
          <div className="reviews-head">
            <h2 id="synthesis-heading">
              Review Summary
              <SparkleIcon size={15} />
            </h2>
            <span className="reviews-total">{synthesis.reviewsAnalyzed} analyzed</span>
          </div>
          <hr className="card-divider" />

          <p className="synthesis-overview">{synthesis.overview}</p>

          {synthesis.themes.length > 0 ? (
            <>
              <p className="synthesis-label">Common themes</p>
              <div className="theme-list">
                {synthesis.themes.map((theme) => (
                  <span
                    className={`theme-chip theme-${theme.sentiment}`}
                    key={theme.topic}
                    title={`Mentioned in ${theme.mentions} ${theme.mentions === 1 ? "review" : "reviews"}`}
                  >
                    {theme.topic} · {theme.mentions}
                  </span>
                ))}
              </div>
            </>
          ) : null}

          {synthesis.strengths.length > 0 ? (
            <>
              <p className="synthesis-label">Strengths</p>
              <ul className="synthesis-list">
                {synthesis.strengths.map((item) => (
                  <li className="synthesis-strength" key={item}>{item}</li>
                ))}
              </ul>
            </>
          ) : null}

          {synthesis.concerns.length > 0 ? (
            <>
              <p className="synthesis-label">Concerns</p>
              <ul className="synthesis-list">
                {synthesis.concerns.map((item) => (
                  <li className="synthesis-concern" key={item}>{item}</li>
                ))}
              </ul>
            </>
          ) : null}

          {synthesis.strengths.length === 0 && synthesis.concerns.length === 0 && synthesis.reviewsAnalyzed > 0 ? (
            <p className="synthesis-note">
              Reviewers did not agree often enough to list distinct strengths or concerns.
            </p>
          ) : null}

          <p className="synthesis-note">
            Counted from the wording of {synthesis.reviewsAnalyzed}{" "}
            {synthesis.reviewsAnalyzed === 1 ? "review" : "reviews"}; no AI model is used.
          </p>
        </section>

        <section className="reviews-card" aria-labelledby="reviews-heading">
          <div className="reviews-head">
            <h2 id="reviews-heading">Top Reviews</h2>
            <span className="reviews-total">{professor.reviewCount} total</span>
          </div>
          <hr className="card-divider" />

          {professor.reviews.length === 0 ? (
            <p className="empty-state">No reviews are available for this professor yet.</p>
          ) : (
            professor.reviews.map((review) => (
              <article className="review-item" key={review.id}>
                <div className="review-head">
                  <span className="review-origin">{review.classYear} • {review.courseCode}</span>
                  <span
                    className="pill pill-star"
                    aria-label={`Review rating ${review.rating.toFixed(1)} out of ${ratingScaleMax}`}
                  >
                    <StarIcon size={15} />
                    {review.rating.toFixed(1)}
                  </span>
                </div>
                <p className="review-text">{review.text}</p>
              </article>
            ))
          )}
        </section>
      </div>
    </div>
  );
}
