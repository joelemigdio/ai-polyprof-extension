import type { CourseOffering, Professor } from "../models/professor";
import type { ProfessorMatch } from "../services/preference-matching";
import { SparkleIcon } from "./Icons";
import { RatingPills } from "./RatingPills";

interface ClassCardProps {
  course: CourseOffering;
  topProfessor: Professor;
  match: ProfessorMatch;
  onSelect: (course: CourseOffering) => void;
}

export function ClassCard({ course, topProfessor, match, onSelect }: ClassCardProps) {
  const fitText = match.fitLine.replace(/^Fits: /, "Fits ");

  return (
    <button className="entity-card" type="button" onClick={() => onSelect(course)}>
      <div className="card-top">
        <div className="card-identity">
          <h2 className="card-title">{course.code}</h2>
          <p className="card-subtitle">{course.title} • {topProfessor.name}</p>
        </div>
        <RatingPills starRating={topProfessor.starRating} peerRating={topProfessor.peerRating} />
      </div>
      <hr className="card-divider" />
      <p className="fit-line">
        <SparkleIcon size={15} />
        {match.matchPercent === null ? fitText : `${match.matchPercent}% Match: ${fitText}`}
      </p>
    </button>
  );
}
