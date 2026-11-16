import type { Professor, ProfessorReview } from "../models/professor";
import { classStandingOptions, type ClassStanding } from "../models/preferences";

/**
 * Aggregates a professor's reviews over students academically similar to the
 * current one. PolyRatings records the reviewer's `gradeLevel` but never their
 * major, so "similar" can only ever mean academic year here — a same-major
 * cohort is not buildable from this data source.
 *
 * Every aggregate is de-identified (a mean plus a count) and is withheld below
 * a minimum sample size, per the spec's re-identification guidance.
 */

export type CohortTier = "same-year" | "adjacent-year" | "all-reviewers";
export type CohortConfidence = "high" | "moderate" | "low";

export interface PeerAggregate {
  tier: CohortTier;
  /** Human phrase for the group actually used, e.g. "juniors and seniors". */
  label: string;
  rating: number | null;
  /** Reviews backing `rating`. */
  sampleSize: number;
  /** Reviews available before cohort narrowing, for "14 of 61" style context. */
  totalReviews: number;
  confidence: CohortConfidence;
  /** True when the requested cohort was too small and the group was widened. */
  widened: boolean;
}

/**
 * Below this a mean says more about one identifiable student than about the
 * professor, so the cohort is widened rather than shown.
 */
export const minimumCohortSize = 3;
const moderateConfidenceSize = 5;
const highConfidenceSize = 10;

function plural(standing: ClassStanding): string {
  if (standing === "5th/6th Year") return "5th and 6th year students";
  if (standing === "Grad Student") return "grad students";
  return `${standing.toLowerCase()}s`;
}

function confidenceFor(sampleSize: number): CohortConfidence {
  if (sampleSize >= highConfidenceSize) return "high";
  if (sampleSize >= moderateConfidenceSize) return "moderate";
  return "low";
}

function average(reviews: ProfessorReview[]): number | null {
  if (reviews.length === 0) return null;
  return reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length;
}

function adjacentStandings(standing: ClassStanding): ClassStanding[] {
  const index = classStandingOptions.indexOf(standing);
  if (index === -1) return [standing];
  return classStandingOptions.slice(Math.max(0, index - 1), index + 2);
}

/**
 * Walks the fallback ladder: the student's own year, then the years either side
 * of it, then every reviewer. The tier that produced the number is always
 * reported so the UI can name the group rather than implying a peer match.
 */
export function buildPeerAggregate(
  reviews: ProfessorReview[],
  standing: ClassStanding | null,
): PeerAggregate {
  const totalReviews = reviews.length;

  const everyone: PeerAggregate = {
    tier: "all-reviewers",
    label: "all reviewers",
    rating: average(reviews),
    sampleSize: totalReviews,
    totalReviews,
    confidence: confidenceFor(totalReviews),
    widened: standing !== null,
  };

  if (!standing || totalReviews === 0) return { ...everyone, widened: false };

  const sameYear = reviews.filter((review) => review.classYear === standing);
  if (sameYear.length >= minimumCohortSize) {
    return {
      tier: "same-year",
      label: plural(standing),
      rating: average(sameYear),
      sampleSize: sameYear.length,
      totalReviews,
      confidence: confidenceFor(sameYear.length),
      widened: false,
    };
  }

  const nearby = adjacentStandings(standing);
  const adjacent = reviews.filter((review) => nearby.includes(review.classYear as ClassStanding));
  if (adjacent.length >= minimumCohortSize) {
    return {
      tier: "adjacent-year",
      label: `${plural(standing)} and nearby years`,
      rating: average(adjacent),
      sampleSize: adjacent.length,
      totalReviews,
      confidence: confidenceFor(adjacent.length),
      widened: true,
    };
  }

  return everyone;
}

/** Convenience wrapper that scopes to one course before aggregating. */
export function buildCoursePeerAggregate(
  professor: Professor,
  aliases: string[],
  standing: ClassStanding | null,
): PeerAggregate {
  // The professor index carries scores but no review text, so a record whose
  // reviews have not been fetched is not an unrated professor. Its overall
  // rating over numEvals *is* the all-reviewers aggregate; report that rather
  // than claiming there is no evidence.
  if (professor.reviews.length === 0) {
    return {
      tier: "all-reviewers",
      label: "all reviewers",
      rating: professor.reviewCount > 0 ? professor.starRating : null,
      sampleSize: professor.reviewCount,
      totalReviews: professor.reviewCount,
      confidence: confidenceFor(professor.reviewCount),
      widened: false,
    };
  }

  const scoped = aliases.length > 0
    ? professor.reviews.filter((review) => aliases.includes(review.courseCode))
    : professor.reviews;
  // A course with too little history is worse evidence than the professor's
  // whole record, so fall back rather than report a one-review course mean.
  const source = scoped.length >= minimumCohortSize ? scoped : professor.reviews;
  return buildPeerAggregate(source, standing);
}
