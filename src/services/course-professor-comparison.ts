import type { CourseInstructor, CourseProfessorComparison, Professor } from "../models/professor";
import { findConfidentProfessor } from "../content/professor-detection";
import type { StudentPreferences } from "../models/preferences";
import { matchProfessor } from "./preference-matching";

function findProviderProfessor(instructorName: string, professors: Professor[]): Professor | null {
  return findConfidentProfessor(instructorName, professors);
}

/**
 * Maps only provider-backed values into the course card. The extension's
 * provider is the real PolyRatings index in Student Center, while fixtures use
 * the same contract locally; neither path invents a rating or teaching trait.
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
      overallRating: professor?.starRating ?? null,
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
