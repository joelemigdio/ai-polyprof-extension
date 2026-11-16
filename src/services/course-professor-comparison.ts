import type { CourseInstructor, CourseProfessorComparison, Professor } from "../models/professor";
import { findConfidentProfessor } from "../content/professor-detection";

const maxComparedTags = 3;

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
): CourseProfessorComparison[] {
  return instructors.map((instructor) => {
    const professor = findConfidentProfessor(instructor.instructorName, professors);

    return {
      instructor,
      professorId: professor?.id ?? null,
      professorName: professor?.name ?? null,
      overallRating: professor?.starRating ?? null,
      clarityRating: professor?.clarityRating ?? null,
      supportRating: professor?.supportRating ?? null,
      reviewCount: professor?.reviewCount ?? null,
      tags: professor?.tags.slice(0, maxComparedTags) ?? [],
    };
  });
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
