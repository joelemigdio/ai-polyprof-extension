import { useCallback, useEffect, useMemo, useState } from "react";
import type { CourseOffering, Professor } from "../models/professor";
import { favoriteId, type FavoriteClass } from "../models/favorites";
import { createDefaultPreferences, traitLabel, type StudentPreferences } from "../models/preferences";
import { mockProfessorDataService } from "../services/mock-professor-data-service";
import { addFavorite, loadFavorites, removeFavorite } from "../services/favorites-storage";
import { loadPreferences } from "../services/preference-storage";
import { AppHeader } from "./AppHeader";
import { ComparisonScreen } from "./ComparisonScreen";
import { DetailScreen } from "./DetailScreen";
import { FavoritesScreen } from "./FavoritesScreen";
import { MatchingBanner } from "./MatchingBanner";
import { PreferencesScreen } from "./PreferencesScreen";
import { ResultsScreen } from "./ResultsScreen";
import { SearchScreen } from "./SearchScreen";

type View = "search" | "results" | "detail" | "preferences" | "favorites" | "compare";

export function App() {
  const [professors, setProfessors] = useState<Professor[]>([]);
  const [courses, setCourses] = useState<CourseOffering[]>([]);
  const [preferences, setPreferences] = useState<StudentPreferences>(createDefaultPreferences);
  const [favorites, setFavorites] = useState<FavoriteClass[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [view, setView] = useState<View>("search");
  const [selectedCourse, setSelectedCourse] = useState<CourseOffering | null>(null);
  const [selectedProfessor, setSelectedProfessor] = useState<Professor | null>(null);

  useEffect(() => {
    void Promise.all([
      mockProfessorDataService.getProfessorResults(),
      mockProfessorDataService.getCourseOfferings(),
      loadPreferences().catch(() => createDefaultPreferences()),
      loadFavorites().catch(() => [] as FavoriteClass[]),
    ])
      .then(([professorResults, courseResults, storedPreferences, storedFavorites]) => {
        setProfessors(professorResults);
        setCourses(courseResults);
        setPreferences(storedPreferences);
        setFavorites(storedFavorites);
        setLoadError(null);
      })
      .catch(() => {
        setLoadError("PolyProf could not load class and professor data. Check your connection, then reopen the extension.");
      })
      .finally(() => setIsLoading(false));
  }, []);

  const professorsById = useMemo(
    () => new Map(professors.map((professor) => [professor.id, professor])),
    [professors],
  );

  const favoriteIds = useMemo(() => new Set(favorites.map((favorite) => favorite.id)), [favorites]);

  const courseProfessors = useMemo(() => {
    if (!selectedCourse) return [];
    return selectedCourse.professorIds
      .map((id) => professorsById.get(id))
      .filter((professor): professor is Professor => Boolean(professor));
  }, [professorsById, selectedCourse]);

  const toggleFavorite = useCallback(async (course: CourseOffering, professor: Professor) => {
    const id = favoriteId(course.code, professor.id);
    const next = favoriteIds.has(id)
      ? await removeFavorite(id)
      : await addFavorite({
          id,
          courseCode: course.code,
          courseTitle: course.title,
          professorId: professor.id,
          professorName: professor.name,
          starRating: professor.starRating,
          clarityRating: professor.clarityRating,
          savedAt: new Date().toISOString(),
        });
    setFavorites(next);
  }, [favoriteIds]);

  const openCourseByCode = useCallback((courseCode: string) => {
    const course = courses.find((entry) => entry.code === courseCode);
    if (!course) return;
    setSelectedCourse(course);
    setView("results");
  }, [courses]);

  const matchingSummary = preferences.learningStyles.length > 0
    ? `${preferences.learningStyles.map((key, index) => (index === 0 ? traitLabel(key) : traitLabel(key).toLowerCase())).join(", ")}.`
    : "no learning style selected yet.";

  return (
    <div className="app">
      <AppHeader
        isPreferencesOpen={view === "preferences"}
        isFavoritesOpen={view === "favorites"}
        favoritesCount={favorites.length}
        onToggle={() => setView(view === "preferences" ? "search" : "preferences")}
        onToggleFavorites={() => setView(view === "favorites" ? "search" : "favorites")}
      />

      {isLoading ? <p className="empty-state">Loading…</p> : null}

      {!isLoading && loadError ? (
        <div className="error-state" role="alert">
          <p className="error-title">Data unavailable</p>
          <p className="error-body">{loadError}</p>
        </div>
      ) : null}

      {!isLoading && !loadError && view === "search" ? (
        <>
          <MatchingBanner summary={matchingSummary} onEdit={() => setView("preferences")} />
          <SearchScreen
            courses={courses}
            professorsById={professorsById}
            preferences={preferences}
            favoriteIds={favoriteIds}
            onToggleFavorite={toggleFavorite}
            onSelectCourse={(course) => {
              setSelectedCourse(course);
              setView("results");
            }}
            onOpenPreferences={() => setView("preferences")}
          />
        </>
      ) : null}

      {!isLoading && !loadError && view === "results" && selectedCourse ? (
        <ResultsScreen
          course={selectedCourse}
          professors={courseProfessors}
          preferences={preferences}
          onSelectProfessor={(professor) => {
            setSelectedProfessor(professor);
            setView("detail");
          }}
          onCompare={() => setView("compare")}
          onBack={() => setView("search")}
        />
      ) : null}

      {!isLoading && !loadError && view === "detail" && selectedProfessor ? (
        <DetailScreen
          professor={selectedProfessor}
          preferences={preferences}
          onBack={() => setView(selectedCourse ? "results" : "search")}
        />
      ) : null}

      {!isLoading && !loadError && view === "compare" && selectedCourse ? (
        <ComparisonScreen
          course={selectedCourse}
          professors={courseProfessors}
          onBack={() => setView("results")}
        />
      ) : null}

      {!isLoading && !loadError && view === "favorites" ? (
        <FavoritesScreen
          favorites={favorites}
          onRemove={(id) => void removeFavorite(id).then(setFavorites)}
          onOpenCourse={openCourseByCode}
          onBrowse={() => setView("search")}
        />
      ) : null}

      {!isLoading && !loadError && view === "preferences" ? (
        <PreferencesScreen preferences={preferences} onChange={setPreferences} />
      ) : null}
    </div>
  );
}
