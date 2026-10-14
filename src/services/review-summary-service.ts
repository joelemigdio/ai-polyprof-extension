import type { ProfessorReview } from "../models/professor";

export interface ReviewInsights {
  summary: string | null;
  themes: string[];
  reviewCount: number;
  averageRating: number | null;
}

/**
 * Contract for review-insight generation. A future backend implementation may
 * use an AI model, but the popup must receive the same safe structured result.
 */
export interface ReviewSummaryService {
  getInsights(reviews: ProfessorReview[]): ReviewInsights;
}
