export type RatingTraitName =
  | "Difficulty"
  | "Workload"
  | "Teaching quality"
  | "Flexibility"
  | "Attendance"
  | "Clarity";

export interface RatingTrait {
  name: RatingTraitName;
  score: number;
}

export interface ProfessorReview {
  id: string;
  courseCode: string;
  submittedAt: string;
  rating: number;
  text: string;
  tags?: string[];
}

export interface Professor {
  id: string;
  name: string;
  department: string;
  overallRating: number;
  reviewCount: number;
  ratingTraits?: RatingTrait[];
  reviews?: ProfessorReview[];
}
