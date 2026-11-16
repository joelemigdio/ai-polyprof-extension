import { formatRating, ratingScaleMax, type Professor } from "../models/professor";
import { traitLabel, type StudentPreferences } from "../models/preferences";
import { formatList, matchProfessor } from "./preference-matching";
import {
  buildCoursePeerAggregate,
  minimumCohortSize,
  type CohortConfidence,
  type PeerAggregate,
} from "./peer-cohort";

/**
 * The spec requires every recommendation to disclose four things: the
 * similarity basis, the peer-group rating, the sample size, and the preference
 * factors applied. This assembles all four from real data and marks the result
 * low-confidence rather than suppressing it silently.
 */
export interface RecommendationExplanation {
  /** Which group the rating came from, e.g. "juniors and nearby years". */
  basis: string;
  peerRating: number | null;
  sampleSize: number;
  totalReviews: number;
  confidence: CohortConfidence;
  /** Named preferences that actually influenced the ranking. */
  preferenceFactors: string[];
  /** One-line summary naming cohort, rating, and sample size together. */
  headline: string;
  /** Present only when the evidence is weak enough to warrant a caveat. */
  caveat: string | null;
  aggregate: PeerAggregate;
}

function describeBasis(aggregate: PeerAggregate, hasStanding: boolean): string {
  if (aggregate.tier === "same-year") return aggregate.label;
  if (aggregate.tier === "adjacent-year") return aggregate.label;
  return hasStanding ? "all reviewers, since your year had too few" : "all reviewers";
}

function buildCaveat(aggregate: PeerAggregate, hasStanding: boolean): string | null {
  if (aggregate.sampleSize === 0) return "No reviews back this recommendation yet.";

  if (!hasStanding) {
    return "Add your class standing in Preferences to compare against students in your year.";
  }
  if (aggregate.tier === "all-reviewers") {
    return `Fewer than ${minimumCohortSize} reviewers from your year, so this uses everyone who reviewed them.`;
  }
  if (aggregate.tier === "adjacent-year") {
    return "Too few reviewers in your exact year, so nearby years are included.";
  }
  if (aggregate.confidence === "low") {
    return `Only ${aggregate.sampleSize} reviewers from your year — treat this as a weak signal.`;
  }
  return null;
}

export function buildRecommendationExplanation(
  professor: Professor,
  preferences: StudentPreferences,
  aliases: string[] = [],
): RecommendationExplanation {
  const aggregate = buildCoursePeerAggregate(professor, aliases, preferences.classStanding);
  const hasStanding = preferences.classStanding !== null;
  const { matchedTraits } = matchProfessor(professor, preferences);
  const preferenceFactors = matchedTraits.map((key) => traitLabel(key).toLowerCase());
  const basis = describeBasis(aggregate, hasStanding);

  const ratingPhrase = aggregate.rating === null
    ? "has no reviews yet"
    : `rated ${professor.name} ${formatRating(aggregate.rating)} out of ${ratingScaleMax}`;
  const samplePhrase = aggregate.sampleSize === aggregate.totalReviews
    ? `${aggregate.sampleSize} ${aggregate.sampleSize === 1 ? "review" : "reviews"}`
    : `${aggregate.sampleSize} of ${aggregate.totalReviews} reviews`;

  const headline = aggregate.rating === null
    ? `No reviews are available for ${professor.name} yet.`
    : `${capitalize(basis)} ${ratingPhrase}, across ${samplePhrase}.`;

  return {
    basis,
    peerRating: aggregate.rating,
    sampleSize: aggregate.sampleSize,
    totalReviews: aggregate.totalReviews,
    confidence: aggregate.confidence,
    preferenceFactors,
    headline,
    caveat: buildCaveat(aggregate, hasStanding),
    aggregate,
  };
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/** Sentence naming the preference factors that moved this professor up the list. */
export function describePreferenceFactors(
  professor: Professor,
  preferences: StudentPreferences,
): string {
  const { matchedTraits } = matchProfessor(professor, preferences);
  if (matchedTraits.length === 0) {
    return "No selected learning style matched, so this is ranked on ratings alone.";
  }
  const rank = preferences.learningStyles.indexOf(matchedTraits[0]) + 1;
  const labels = formatList(matchedTraits.map((key) => traitLabel(key).toLowerCase()));
  return preferences.learningStyles.length > 1
    ? `Matches ${labels} — your number ${rank} priority.`
    : `Matches ${labels}.`;
}
