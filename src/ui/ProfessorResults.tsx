import type { Professor } from "../models/professor";
import { ProfessorResultCard } from "./ProfessorResultCard";

interface ProfessorResultsProps {
  professors: Professor[];
  onViewDetails: (professor: Professor) => void;
  onOpenPreferences: () => void;
}

export function ProfessorResults({ professors, onViewDetails, onOpenPreferences }: ProfessorResultsProps) {
  return (
    <section aria-label="Mock professor results">
      <p className="demo-label">Demo data only — not live PolyRatings data</p>
      <button className="preferences-button" type="button" onClick={onOpenPreferences}>Preferences</button>
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
