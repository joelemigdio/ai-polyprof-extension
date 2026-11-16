import type { TraitKey } from "./preferences";

/** PolyRatings scores every field from 0 to 4, not 0 to 5. */
export const ratingScaleMax = 4;

/**
 * Two decimals, matching how polyratings.dev prints the same number. Rounding
 * to one decimal made the extension look wrong next to the site it quotes.
 */
export function formatRating(value: number): string {
  return value.toFixed(2);
}

export interface ProfessorReview {
  id: string;
  /** Course the review was filed under, as PolyRatings stores it (e.g. "CSC 357"). */
  courseCode: string;
  /** PolyRatings grade level, which includes "5th/6th Year" and "Grad Student". */
  classYear: string;
  rating: number;
  text: string;
  grade: string;
  courseType: string;
  postDate: string;
}

export interface Professor {
  id: string;
  name: string;
  /** Kept separate from `name` because instructor fields on the portal are "Last,First". */
  firstName: string;
  lastName: string;
  department: string;
  courses: string[];
  /** Overall rating shown in the cream star pill. */
  starRating: number;
  /** PolyRatings "presents material clearly". */
  clarityRating: number;
  /** PolyRatings "recognizes student difficulties". */
  supportRating: number;
  reviewCount: number;
  /** PolyRatings tags, most-cited first. Free-form, not the TraitKey vocabulary. */
  tags: string[];
  traits: TraitKey[];
  /** Traits students consistently report this professor is weak on. */
  weakTraits: TraitKey[];
  /** Most recent first. Empty until the professor's detail record is fetched. */
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

/**
 * Data that the current provider can substantiate for one visible instructor.
 *
 * The fields mirror what PolyRatings actually measures. An earlier shape had
 * workload/difficulty/flexibility columns that no real field backs; in
 * particular `studentDifficulties` means "recognizes student difficulties"
 * (higher is better), so surfacing it as "difficulty" would invert its meaning.
 */
export interface CourseProfessorComparison {
  instructor: CourseInstructor;
  professorId: string | null;
  professorName: string | null;
  overallRating: number | null;
  /** PolyRatings "presents material clearly". */
  clarityRating: number | null;
  /** PolyRatings "recognizes student difficulties". */
  supportRating: number | null;
  reviewCount: number | null;
  /** Most-cited PolyRatings tags, verbatim. */
  tags: string[];
}

/** Reserved result contract for the future preference-aware ranking service. */
export interface RecommendationResult {
  courseCode: string;
  status: "coming-soon" | "unavailable";
  recommendedProfessorIds: string[];
}

/** A professor's reviews narrowed to one course, for the class hover card. */
export interface CourseScopedRating {
  rating: number | null;
  reviewCount: number;
  reviews: ProfessorReview[];
}

export function scopeToCourse(professor: Professor, aliases: string[]): CourseScopedRating {
  const matching = professor.reviews.filter((review) => aliases.includes(review.courseCode));
  if (matching.length === 0) return { rating: null, reviewCount: 0, reviews: [] };
  const total = matching.reduce((sum, review) => sum + review.rating, 0);
  return { rating: total / matching.length, reviewCount: matching.length, reviews: matching };
}
