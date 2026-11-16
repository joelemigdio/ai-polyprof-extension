import type { CourseOffering, Professor } from "../models/professor";
import type { ProfessorMatch } from "../services/preference-matching";
import { SparkleIcon, StarIcon } from "./Icons";
import { RatingPills } from "./RatingPills";

interface ClassCardProps {
  course: CourseOffering;
  topProfessor: Professor;
  match: ProfessorMatch;
  isFavorite: boolean;
  onSelect: (course: CourseOffering) => void;
  onToggleFavorite: (course: CourseOffering, professor: Professor) => void;
}

export function ClassCard({
  course,
  topProfessor,
  match,
  isFavorite,
  onSelect,
  onToggleFavorite,
}: ClassCardProps) {
  const fitText = match.fitLine.replace(/^Fits: /, "Fits ");

  return (
    <div className="entity-card-wrap">
      <button className="entity-card" type="button" onClick={() => onSelect(course)}>
        <div className="card-top">
          <div className="card-identity">
            <h2 className="card-title">{course.code}</h2>
            <p className="card-subtitle">{course.title} • {topProfessor.name}</p>
          </div>
          <RatingPills starRating={topProfessor.starRating} clarityRating={topProfessor.clarityRating} />
        </div>
        <hr className="card-divider" />
        <p className="fit-line">
          <SparkleIcon size={15} />
          {match.matchPercent === null ? fitText : `${match.matchPercent}% Match: ${fitText}`}
        </p>
      </button>
      <button
        className={isFavorite ? "favorite-toggle is-favorite" : "favorite-toggle"}
        type="button"
        onClick={() => onToggleFavorite(course, topProfessor)}
        aria-pressed={isFavorite}
        aria-label={isFavorite ? `Remove ${course.code} from favorites` : `Save ${course.code} to favorites`}
      >
        <StarIcon size={17} />
      </button>
    </div>
  );
}
