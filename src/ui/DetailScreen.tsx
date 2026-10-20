import type { Professor } from "../models/professor";
import type { StudentPreferences } from "../models/preferences";
import { matchProfessor } from "../services/preference-matching";
import { ArrowLeftIcon, StarIcon } from "./Icons";
import { ProfessorCard } from "./ProfessorCard";

interface DetailScreenProps {
  professor: Professor;
  preferences: StudentPreferences;
  onBack: () => void;
}

export function DetailScreen({ professor, preferences, onBack }: DetailScreenProps) {
  return (
    <div className="screen">
      <div className="scroll-area">
        <button className="back-button" type="button" onClick={onBack}>
          <ArrowLeftIcon size={16} />
          Back to results
        </button>

        <ProfessorCard professor={professor} match={matchProfessor(professor, preferences)} />

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
                  <span className="pill pill-star" aria-label={`Review rating ${review.rating.toFixed(1)} out of 5`}>
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
