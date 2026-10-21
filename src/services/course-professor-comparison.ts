import type { CourseInstructor, CourseProfessorComparison, Professor } from "../models/professor";

function findProviderProfessor(instructorName: string, professors: Professor[]): Professor | null {
  const normalized = instructorName.replace(/\s+/g, " ").trim().toLocaleLowerCase();
  const matches = professors.filter((professor) => professor.name.replace(/\s+/g, " ").trim().toLocaleLowerCase() === normalized);
  return matches.length === 1 ? matches[0] : null;
}

/**
 * Maps only provider-backed values into the course card. In live Student
 * Center documents `useMockData` is false, so no demonstration ratings can be
 * presented as ratings for a real instructor.
 */
export function buildCourseProfessorComparisons(
  instructors: CourseInstructor[],
  professors: Professor[],
  useMockData: boolean,
): CourseProfessorComparison[] {
  return instructors.map((instructor) => {
    const professor = useMockData
      ? findProviderProfessor(instructor.instructorName, professors)
      : null;

    return {
      instructor,
      professorId: professor?.id ?? null,
      overallRating: professor?.starRating ?? null,
      reviewCount: professor?.reviewCount ?? null,
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
