import { useMemo, useState } from "react";
import type { CourseOffering, Professor } from "../models/professor";
import { favoriteId } from "../models/favorites";
import type { StudentPreferences } from "../models/preferences";
import { matchProfessor, rankProfessors } from "../services/preference-matching";
import { ClassCard } from "./ClassCard";
import { ChevronDownIcon, ClearIcon, SearchIcon } from "./Icons";

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
  const isSearching = query.trim().length > 0;

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
        {isSearching ? (
          <button className="link-button" type="button" onClick={() => setQuery("")}>Clear</button>
        ) : null}
      </div>

      <div className="scroll-area">
        {isSearching ? (
          <>
            <div className="section-head">
              <p className="section-label">Search results</p>
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
          </>
        ) : (
          <section className="search-home" aria-labelledby="search-home-heading">
            <SearchIcon size={24} />
            <h2 id="search-home-heading">Find a class or professor</h2>
            <p>
              Search by course code, course title, or professor name. Results are ranked using your saved preferences.
            </p>
          </section>
        )}
      </div>
    </div>
  );
}
