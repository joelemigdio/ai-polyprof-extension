import type { Professor } from "../models/professor";
import { ProfessorResultCard } from "./ProfessorResultCard";

interface ProfessorResultsProps {
  professors: Professor[];
  onViewDetails: (professor: Professor) => void;
}

export function ProfessorResults({ professors, onViewDetails }: ProfessorResultsProps) {
  return (
    <section aria-label="Mock professor results">
      <p className="demo-label">Demo data only — not live PolyRatings data</p>
      <div className="results-list">
        {professors.map((professor) => (
          <ProfessorResultCard
            key={professor.id}
            professor={professor}
            onViewDetails={onViewDetails}
          />
        ))}
      </div>
    </section>
  );
}
