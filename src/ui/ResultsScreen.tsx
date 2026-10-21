import { useMemo } from "react";
import type { CourseOffering, Professor } from "../models/professor";
import type { StudentPreferences } from "../models/preferences";
import { buildRecommendationReason, matchProfessor, rankProfessors } from "../services/preference-matching";
import { ArrowLeftIcon, CloverIcon } from "./Icons";
import { ProfessorCard } from "./ProfessorCard";
import { RatingPills } from "./RatingPills";

interface ResultsScreenProps {
  course: CourseOffering;
  professors: Professor[];
  preferences: StudentPreferences;
  onSelectProfessor: (professor: Professor) => void;
  onBack: () => void;
}

export function ResultsScreen({ course, professors, preferences, onSelectProfessor, onBack }: ResultsScreenProps) {
  const ranked = useMemo(() => rankProfessors(professors, preferences), [professors, preferences]);
  const recommended = ranked[0];

  return (
    <div className="screen">
      <div className="scroll-area">
        <button className="back-button" type="button" onClick={onBack}>
          <ArrowLeftIcon size={16} />
          Back to search
        </button>

        <div className="section-head">
          <h1 className="course-heading">{course.code} • {course.title}</h1>
          <span className="section-count">{ranked.length === 1 ? "1 professor" : `${ranked.length} professors`}</span>
        </div>

        {ranked.length === 0 ? (
          <p className="empty-state">No professor information is available for this class yet.</p>
        ) : (
          <div className="card-list">
            {ranked.map((professor) => (
              <ProfessorCard
                key={professor.id}
                professor={professor}
                match={matchProfessor(professor, preferences)}
                onSelect={onSelectProfessor}
              />
            ))}
          </div>
        )}
      </div>

      {recommended ? (
        <section className="ai-panel" aria-label="AI recommendation">
          <h2 className="ai-panel-title">
            AI Recommendation
            <CloverIcon size={16} />
          </h2>
          <p className="ai-panel-sub">Best fit based on your criteria</p>

          <div className="ai-pick">
            <div className="card-identity">
              <h3>{recommended.name}</h3>
              <p className="ai-pick-meta">{recommended.department} • {recommended.courses.join(", ")}</p>
              <p className="ai-pick-reason">{buildRecommendationReason(recommended, preferences)}</p>
            </div>
            <RatingPills starRating={recommended.starRating} clarityRating={recommended.clarityRating} />
          </div>

          <div className="panel-actions">
            <button className="button-primary" type="button" onClick={() => onSelectProfessor(recommended)}>
              View Profile
            </button>
            <button className="button-ghost" type="button" disabled title="Side-by-side comparison is not part of the alpha">
              Compare
            </button>
          </div>
        </section>
      ) : null}
    </div>
  );
}
