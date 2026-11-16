import type { CourseInstructor, CourseProfessorComparison, Professor } from "../models/professor";
import { findConfidentProfessor } from "../content/professor-detection";
import type { StudentPreferences } from "../models/preferences";
import { matchProfessor } from "./preference-matching";

const maxComparedTags = 3;

function findProviderProfessor(instructorName: string, professors: Professor[]): Professor | null {
  return findConfidentProfessor(instructorName, professors);
}

/**
 * Resolves each visible instructor to their PolyRatings record.
 *
 * Every value here comes from the professor index, which the background worker
 * already caches, so a comparison costs no extra network call. Unmatched or
 * ambiguous names resolve to nulls rather than a guess.
 */
export function buildCourseProfessorComparisons(
  instructors: CourseInstructor[],
  professors: Professor[],
  preferences: StudentPreferences,
): CourseProfessorComparison[] {
  return instructors.map((instructor) => {
    const professor = findProviderProfessor(instructor.instructorName, professors);
    const match = professor ? matchProfessor(professor, preferences) : null;

    return {
      instructor,
      professorId: professor?.id ?? null,
      professorName: professor?.name ?? null,
      overallRating: professor?.starRating ?? null,
      clarityRating: professor?.clarityRating ?? null,
      supportRating: professor?.supportRating ?? null,
      reviewCount: professor?.reviewCount ?? null,
      preferenceFit: match?.matchPercent ?? null,
      fitLine: match?.fitLine ?? null,
      matchedTraits: match?.matchedTraits ?? [],
      conflictingTraits: match?.conflictingTraits ?? [],
      // The alpha provider has tags rather than structured numeric trait
      // scores. Keep those unavailable instead of inferring values.
      workload: null,
      difficulty: null,
      clarity: null,
      flexibility: null,
      reviewThemes: professor?.traits ?? [],
      tags: professor?.tags.slice(0, maxComparedTags) ?? [],
    };
  });
}

/**
 * Picks a recommendation from instructors currently visible in Student Center.
 * Preference fit already incorporates ratings; when preferences are empty or
 * tied, use overall rating and review count as deterministic tie-breakers.
 */
export function recommendCourseProfessor(
  comparisons: CourseProfessorComparison[],
): CourseProfessorComparison | null {
  const rated = comparisons.filter((comparison) => comparison.overallRating !== null);
  if (rated.length === 0) return null;
  return [...rated].sort((left, right) => {
    const fitDifference = (right.preferenceFit ?? -1) - (left.preferenceFit ?? -1);
    if (fitDifference !== 0) return fitDifference;
    const ratingDifference = (right.overallRating ?? 0) - (left.overallRating ?? 0);
    if (ratingDifference !== 0) return ratingDifference;
    return (right.reviewCount ?? 0) - (left.reviewCount ?? 0);
  })[0];
}

/** Best-rated first so the comparison opens on the strongest option. */
export function rankComparisons(comparisons: CourseProfessorComparison[]): CourseProfessorComparison[] {
  return [...comparisons].sort((left, right) => (right.overallRating ?? -1) - (left.overallRating ?? -1));
}

/**
 * Highest value per metric, used to mark the leader in each row. Returns null
 * for a metric when fewer than two instructors can be compared on it.
 */
export function comparisonLeaders(comparisons: CourseProfessorComparison[]): {
  overallRating: number | null;
  clarityRating: number | null;
  supportRating: number | null;
} {
  function best(pick: (entry: CourseProfessorComparison) => number | null): number | null {
    const values = comparisons.map(pick).filter((value): value is number => value !== null);
    return values.length >= 2 ? Math.max(...values) : null;
  }

  return {
    overallRating: best((entry) => entry.overallRating),
    clarityRating: best((entry) => entry.clarityRating),
    supportRating: best((entry) => entry.supportRating),
  };
}
