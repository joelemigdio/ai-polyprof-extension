import type { RecommendationResult } from "../models/professor";
import type { StudentPreferences } from "../models/preferences";

/**
 * Intentionally non-ranking contract for the future recommendation provider.
 * It makes the required inputs explicit without creating a score from mock or
 * incomplete Student Center data.
 */
export interface CourseRecommendationService {
  getRecommendedProfessors(
    courseCode: string,
    professorIds: string[],
    preferences: StudentPreferences,
  ): Promise<RecommendationResult>;
}

export const futureCourseRecommendationService: CourseRecommendationService = {
  async getRecommendedProfessors(courseCode): Promise<RecommendationResult> {
    return { courseCode, status: "coming-soon", recommendedProfessorIds: [] };
  },
};
