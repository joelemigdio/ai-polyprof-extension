import type { TraitKey } from "./preferences";

export type ClassYear = "Freshman" | "Sophomore" | "Junior" | "Senior" | "Graduate";

export interface ProfessorReview {
  id: string;
  courseCode: string;
  classYear: ClassYear;
  rating: number;
  text: string;
}

export interface Professor {
  id: string;
  name: string;
  department: string;
  courses: string[];
  /** Overall PolyRatings-style score shown in the cream star pill. */
  starRating: number;
  /** Aggregate score from students with a similar academic background. */
  peerRating: number;
  reviewCount: number;
  traits: TraitKey[];
  /** Traits students consistently report this professor is weak on. */
  weakTraits: TraitKey[];
  reviews: ProfessorReview[];
}

/** A course identified locally from the current Student Center document. */
export interface Course {
  code: string;
  /** Null when the current page exposes a code but no verified title field. */
  title: string | null;
}

/** An instructor seen in the currently rendered Student Center sections. */
export interface CourseInstructor {
  instructorName: string;
  displayName: string;
  source: "currently-visible-section";
}

/**
 * Catalog-style offering returned by a data provider. It is distinct from a
 * locally detected visible section and may eventually represent a full term.
 */
export interface CourseOffering {
  code: string;
  title: string;
  department: string;
  term: string;
  professorIds: string[];
}

/** Data that the current provider can substantiate for one visible instructor. */
export interface CourseProfessorComparison {
  instructor: CourseInstructor;
  professorId: string | null;
  overallRating: number | null;
  reviewCount: number | null;
  workload: string | null;
  difficulty: string | null;
  clarity: string | null;
  flexibility: string | null;
  reviewThemes: string[];
}

/** Reserved result contract for the future preference-aware ranking service. */
export interface RecommendationResult {
  courseCode: string;
  status: "coming-soon" | "unavailable";
  recommendedProfessorIds: string[];
}
