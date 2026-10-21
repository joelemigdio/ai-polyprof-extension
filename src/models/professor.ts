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

export interface CourseOffering {
  code: string;
  title: string;
  department: string;
  term: string;
  professorIds: string[];
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
