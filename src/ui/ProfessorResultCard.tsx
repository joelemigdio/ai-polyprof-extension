import type { Professor } from "../models/professor";

interface ProfessorResultCardProps {
  professor: Professor;
  onViewDetails: (professor: Professor) => void;
}

export function ProfessorResultCard({ professor, onViewDetails }: ProfessorResultCardProps) {
  return (
    <article className="professor-card">
      <div className="card-heading">
        <div>
          <h2>{professor.name || "Professor unavailable"}</h2>
          <p>{professor.department || "Department unavailable"}</p>
        </div>
        <div className="rating" aria-label={`${professor.overallRating ?? "unavailable"} overall rating`}>
          <span aria-hidden="true">★</span> {professor.overallRating?.toFixed(1) ?? "—"}
        </div>
      </div>
      <p className="review-count">{professor.reviewCount ?? 0} demo reviews</p>
      <div className="traits" aria-label="Available rating traits">
        {(professor.ratingTraits ?? []).slice(0, 3).map((trait) => (
          <span key={trait.name}>{trait.name}: {trait.score.toFixed(1)}</span>
        ))}
      </div>
      <button type="button" onClick={() => onViewDetails(professor)}>
        View Details
      </button>
    </article>
  );
}
