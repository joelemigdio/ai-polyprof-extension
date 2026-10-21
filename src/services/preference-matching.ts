import { ratingScaleMax, type Professor } from "../models/professor";
import {
  traitFitPhrase,
  traitLabel,
  traitWeakPhrase,
  type StudentPreferences,
  type TraitKey,
} from "../models/preferences";

export interface ProfessorMatch {
  /** Null when the student has not selected any learning styles to match on. */
  matchPercent: number | null;
  fitLine: string;
  hasCaveat: boolean;
  matchedTraits: TraitKey[];
  conflictingTraits: TraitKey[];
}

const overlapWeight = 0.65;
const ratingWeight = 0.35;

export function formatList(items: string[]): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items.at(-1)}`;
}

function capitalizeFirst(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function matchProfessor(professor: Professor, preferences: StudentPreferences): ProfessorMatch {
  const selected = preferences.learningStyles;
  const matchedTraits = selected.filter((key) => professor.traits.includes(key));
  const conflictingTraits = selected.filter((key) => professor.weakTraits.includes(key));

  if (selected.length === 0) {
    return {
      matchPercent: null,
      fitLine: "Choose a learning style in Preferences to see how this professor fits.",
      hasCaveat: false,
      matchedTraits,
      conflictingTraits,
    };
  }

  const overlap = matchedTraits.length / selected.length;
  const ratingStrength = (professor.starRating + professor.clarityRating) / (2 * ratingScaleMax);
  const matchPercent = Math.round(100 * (overlapWeight * overlap + ratingWeight * ratingStrength));

  return {
    matchPercent,
    fitLine: buildFitLine(professor, matchedTraits),
    hasCaveat: professor.weakTraits.length > 0 && matchedTraits.length > 0,
    matchedTraits,
    conflictingTraits,
  };
}

const maxFitPhrases = 2;

/**
 * Lists the professor's own traits rather than only the overlap, so a card still
 * describes them when nothing matches. Preference-matched traits lead the list.
 */
function buildFitLine(professor: Professor, matched: TraitKey[]): string {
  if (professor.weakTraits.length > 0 && matched.length > 0) {
    return `Strong fit, but ${traitWeakPhrase(professor.weakTraits[0])} than preferred`;
  }
  if (professor.traits.length === 0) return "No teaching characteristics are recorded yet";

  const ordered = [
    ...matched,
    ...professor.traits.filter((key) => !matched.includes(key)),
  ].slice(0, maxFitPhrases);
  return `Fits: ${capitalizeFirst(ordered.map(traitFitPhrase).join(", "))}`;
}

/** Ranks professors best-first so the recommendation panel can take the winner. */
export function rankProfessors(professors: Professor[], preferences: StudentPreferences): Professor[] {
  return [...professors].sort((left, right) => {
    const leftMatch = matchProfessor(left, preferences).matchPercent ?? 0;
    const rightMatch = matchProfessor(right, preferences).matchPercent ?? 0;
    if (leftMatch !== rightMatch) return rightMatch - leftMatch;
    return right.clarityRating - left.clarityRating;
  });
}

/**
 * Compares every professor teaching one class against the student's saved
 * preferences. Deterministic: no AI model or network call is involved.
 */
export function buildClassSummary(professors: Professor[], preferences: StudentPreferences): string {
  if (professors.length === 0) return "No rated professors are available for this class yet.";
  if (preferences.learningStyles.length === 0) {
    return "Choose a learning style in Preferences to see a personalized comparison of these professors.";
  }

  const ranked = rankProfessors(professors, preferences);
  const [best, ...rest] = ranked;
  const bestMatch = matchProfessor(best, preferences);
  const styles = formatList(preferences.learningStyles.map((key) => traitLabel(key).toLowerCase()));

  const sentences = [
    bestMatch.matchedTraits.length > 0
      ? `Because you prefer ${styles}, ${best.name} fits best at ${bestMatch.matchPercent}% — ${formatList(bestMatch.matchedTraits.map(traitFitPhrase))}.`
      : `None of these professors match ${styles}, so ${best.name} leads on ratings alone at ${bestMatch.matchPercent}%.`,
  ];

  if (best.weakTraits.length > 0) {
    sentences.push(`Be aware of ${traitWeakPhrase(best.weakTraits[0])} than you prefer.`);
  }

  const runnerUp = rest[0];
  if (runnerUp) {
    const runnerMatch = matchProfessor(runnerUp, preferences);
    sentences.push(
      runnerUp.starRating > best.starRating
        ? `${runnerUp.name} rates higher overall at ${runnerUp.starRating.toFixed(1)} but matches less of what you asked for (${runnerMatch.matchPercent}%).`
        : `${runnerUp.name} is the next closest at ${runnerMatch.matchPercent}%.`,
    );
  }

  return sentences.join(" ");
}

export function buildRecommendationReason(professor: Professor, preferences: StudentPreferences): string {
  const { matchedTraits } = matchProfessor(professor, preferences);
  if (matchedTraits.length === 0) {
    return `Highest combined rating among your departments, though no selected learning style matched.`;
  }
  return `Strongest match for ${formatList(matchedTraits.map(traitLabel).map((label) => label.toLowerCase()))}.`;
}
