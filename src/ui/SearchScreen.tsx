import { useMemo, useState } from "react";
import type { CourseOffering, Professor } from "../models/professor";
import { favoriteId } from "../models/favorites";
import type { StudentPreferences } from "../models/preferences";
import { matchProfessor, rankProfessors } from "../services/preference-matching";
import { recentSearches } from "../services/mock-professor-data-service";
import { ClassCard } from "./ClassCard";
import { BulbIcon, ChevronDownIcon, ClearIcon, ClockIcon, SearchIcon, SparkleIcon } from "./Icons";

interface SearchScreenProps {
  courses: CourseOffering[];
  professorsById: Map<string, Professor>;
  preferences: StudentPreferences;
  favoriteIds: Set<string>;
  onToggleFavorite: (course: CourseOffering, professor: Professor) => void;
  onSelectCourse: (course: CourseOffering) => void;
  onOpenPreferences: () => void;
}

export function SearchScreen({
  courses,
  professorsById,
  preferences,
  favoriteIds,
  onToggleFavorite,
  onSelectCourse,
  onOpenPreferences,
}: SearchScreenProps) {
  const [query, setQuery] = useState("");

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();

    return courses
      .filter((course) => {
        if (preferences.departments.length > 0 && !preferences.departments.some((code) => code === course.department)) {
          return false;
        }
        if (needle.length === 0) return true;
        const professorNames = course.professorIds
          .map((id) => professorsById.get(id)?.name.toLowerCase() ?? "")
          .join(" ");
        return (
          course.code.toLowerCase().includes(needle) ||
          course.title.toLowerCase().includes(needle) ||
          professorNames.includes(needle)
        );
      })
      .map((course) => {
        const professors = course.professorIds
          .map((id) => professorsById.get(id))
          .filter((professor): professor is Professor => Boolean(professor));
        return { course, topProfessor: rankProfessors(professors, preferences)[0] };
      })
      .filter((entry) => Boolean(entry.topProfessor));
  }, [courses, professorsById, preferences, query]);

  const departmentLabel = preferences.departments.length > 0 ? preferences.departments.join(", ") : "All";

  return (
    <div className="screen">
      <div className="search-bar">
        <div className="search-field">
          <SearchIcon size={18} />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search classes or professors"
            aria-label="Search classes or professors"
          />
          {query.length > 0 ? (
            <button className="icon-button" type="button" onClick={() => setQuery("")} aria-label="Clear search">
              <ClearIcon size={18} />
            </button>
          ) : null}
        </div>
      </div>

      <div className="filter-row">
        <button className="filter-chip" type="button" onClick={onOpenPreferences}>
          Dept: {departmentLabel}
          <ChevronDownIcon size={15} />
        </button>
        <button className="filter-chip" type="button" onClick={onOpenPreferences}>
          Term: Winter '26
          <ChevronDownIcon size={15} />
        </button>
        <button className="link-button" type="button" onClick={() => setQuery("")}>Clear</button>
      </div>

      <div className="scroll-area">
        <p className="section-label">Recent searches</p>
        <div className="recent-list">
          {recentSearches.map((term) => (
            <button className="recent-chip" type="button" key={term} onClick={() => setQuery(term)}>
              <ClockIcon size={15} />
              {term}
            </button>
          ))}
        </div>

        <div className="section-head">
          <p className="section-label">Suggested classes</p>
          <span className="section-count">{matches.length} {matches.length === 1 ? "match" : "matches"}</span>
        </div>

        {matches.length === 0 ? (
          <p className="empty-state">No classes match this search in your selected departments.</p>
        ) : (
          <div className="card-list">
            {matches.map(({ course, topProfessor }) => (
              <ClassCard
                key={course.code}
                course={course}
                topProfessor={topProfessor}
                match={matchProfessor(topProfessor, preferences)}
                isFavorite={favoriteIds.has(favoriteId(course.code, topProfessor.id))}
                onSelect={onSelectCourse}
                onToggleFavorite={onToggleFavorite}
              />
            ))}
          </div>
        )}
      </div>

      <section className="smart-footer" aria-label="AI smart search helper">
        <div className="smart-footer-head">
          <h2 className="smart-footer-title">
            AI Smart Search Helper
            <SparkleIcon size={15} />
          </h2>
          <button className="link-button" type="button" onClick={onOpenPreferences}>Configure Criteria</button>
        </div>
        <p className="smart-tip">
          <BulbIcon size={15} />
          <span>
            Try typing <strong>"Project-heavy"</strong> or "Clear Grading" directly into search to filter by your
            preferred learning style!
          </span>
        </p>
      </section>
    </div>
  );
}
