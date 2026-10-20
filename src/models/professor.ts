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

export interface CourseOffering {
  code: string;
  title: string;
  department: string;
  term: string;
  professorIds: string[];
}
