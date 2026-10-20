import { useEffect, useMemo, useState } from "react";
import type { CourseOffering, Professor } from "../models/professor";
import { createDefaultPreferences, traitLabel, type StudentPreferences } from "../models/preferences";
import { mockProfessorDataService } from "../services/mock-professor-data-service";
import { loadPreferences } from "../services/preference-storage";
import { AppHeader } from "./AppHeader";
import { DetailScreen } from "./DetailScreen";
import { MatchingBanner } from "./MatchingBanner";
import { PreferencesScreen } from "./PreferencesScreen";
import { ResultsScreen } from "./ResultsScreen";
import { SearchScreen } from "./SearchScreen";

type View = "search" | "results" | "detail" | "preferences";

export function App() {
  const [professors, setProfessors] = useState<Professor[]>([]);
  const [courses, setCourses] = useState<CourseOffering[]>([]);
  const [preferences, setPreferences] = useState<StudentPreferences>(createDefaultPreferences);
  const [isLoading, setIsLoading] = useState(true);
  const [view, setView] = useState<View>("search");
  const [selectedCourse, setSelectedCourse] = useState<CourseOffering | null>(null);
  const [selectedProfessor, setSelectedProfessor] = useState<Professor | null>(null);

  useEffect(() => {
    void Promise.all([
      mockProfessorDataService.getProfessorResults(),
      mockProfessorDataService.getCourseOfferings(),
      loadPreferences().catch(() => createDefaultPreferences()),
    ]).then(([professorResults, courseResults, storedPreferences]) => {
      setProfessors(professorResults);
      setCourses(courseResults);
      setPreferences(storedPreferences);
      setIsLoading(false);
    });
  }, []);

  const professorsById = useMemo(
    () => new Map(professors.map((professor) => [professor.id, professor])),
    [professors],
  );

  const courseProfessors = useMemo(() => {
    if (!selectedCourse) return [];
    return selectedCourse.professorIds
      .map((id) => professorsById.get(id))
      .filter((professor): professor is Professor => Boolean(professor));
  }, [professorsById, selectedCourse]);

  const matchingSummary = preferences.learningStyles.length > 0
    ? `${preferences.learningStyles.map((key, index) => (index === 0 ? traitLabel(key) : traitLabel(key).toLowerCase())).join(", ")}.`
    : "no learning style selected yet.";

  return (
    <div className="app">
      <AppHeader
        isPreferencesOpen={view === "preferences"}
        onToggle={() => setView(view === "preferences" ? "search" : "preferences")}
      />
      <p className="demo-banner">Demo data only — ratings and reviews are invented</p>

      {isLoading ? <p className="empty-state">Loading…</p> : null}

      {!isLoading && view === "search" ? (
        <>
          <MatchingBanner summary={matchingSummary} onEdit={() => setView("preferences")} />
          <SearchScreen
            courses={courses}
            professorsById={professorsById}
            preferences={preferences}
            onSelectCourse={(course) => {
              setSelectedCourse(course);
              setView("results");
            }}
            onOpenPreferences={() => setView("preferences")}
          />
        </>
      ) : null}

      {!isLoading && view === "results" && selectedCourse ? (
        <ResultsScreen
          course={selectedCourse}
          professors={courseProfessors}
          preferences={preferences}
          onSelectProfessor={(professor) => {
            setSelectedProfessor(professor);
            setView("detail");
          }}
          onBack={() => setView("search")}
        />
      ) : null}

      {!isLoading && view === "detail" && selectedProfessor ? (
        <DetailScreen
          professor={selectedProfessor}
          preferences={preferences}
          onBack={() => setView(selectedCourse ? "results" : "search")}
        />
      ) : null}

      {!isLoading && view === "preferences" ? (
        <PreferencesScreen preferences={preferences} onChange={setPreferences} />
      ) : null}
    </div>
  );
}
