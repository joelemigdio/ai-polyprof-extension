import type { Professor } from "../models/professor";
import type { ProfessorMatch } from "../services/preference-matching";
import { CloverIcon } from "./Icons";
import { RatingPills } from "./RatingPills";

interface ProfessorCardProps {
  professor: Professor;
  match: ProfessorMatch;
  onSelect?: (professor: Professor) => void;
}

export function ProfessorCard({ professor, match, onSelect }: ProfessorCardProps) {
  const body = (
    <>
      <div className="card-top">
        <div className="card-identity">
          <h2 className="card-title">{professor.name}</h2>
          <p className="card-subtitle">{professor.department} • {professor.courses.join(", ")}</p>
        </div>
        <RatingPills starRating={professor.starRating} peerRating={professor.peerRating} />
      </div>
      <hr className="card-divider" />
      <p className="fit-line">
        <CloverIcon size={16} />
        {match.fitLine}
      </p>
    </>
  );

  if (!onSelect) return <article className="entity-card">{body}</article>;

  return (
    <button className="entity-card" type="button" onClick={() => onSelect(professor)}>
      {body}
    </button>
  );
}
