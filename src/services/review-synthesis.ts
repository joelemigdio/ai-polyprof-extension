import type { Professor, ProfessorReview } from "../models/professor";
import { formatList } from "./preference-matching";

/**
 * Condenses a professor's own review text into themes, strengths, and concerns.
 *
 * Deterministic by design: no model is called and no network request is made.
 * Every claim it emits is backed by a counted phrase match in the supplied
 * reviews, so the output cannot assert anything the reviews do not say. When
 * the corpus is too thin to corroborate a theme, it reports limited evidence
 * instead of guessing.
 */

export type ThemeSentiment = "positive" | "negative" | "mixed";

export interface ReviewTheme {
  topic: string;
  sentiment: ThemeSentiment;
  /** Reviews mentioning this topic at all; a review is counted once per topic. */
  mentions: number;
  positiveMentions: number;
  negativeMentions: number;
}

export interface ReviewSynthesis {
  overview: string;
  themes: ReviewTheme[];
  strengths: string[];
  concerns: string[];
  reviewsAnalyzed: number;
  /** True when too few reviews exist to treat the themes as reliable. */
  hasLimitedEvidence: boolean;
}

interface TopicDefinition {
  topic: string;
  positiveCues: string[];
  negativeCues: string[];
  positivePhrase: string;
  negativePhrase: string;
}

/**
 * Cues are deliberately multi-word. Single words like "clear" or "hard" attach
 * to the wrong subject too often to support a claim about a professor.
 */
const topicDefinitions: ReadonlyArray<TopicDefinition> = [
  {
    topic: "Lecture clarity",
    positiveCues: [
      "explains well", "explains everything", "explains concepts", "clear lectures", "very clear",
      "explained clearly", "explains clearly", "easy to follow", "great explanations", "easy to understand",
      "breaks down", "makes it click",
    ],
    negativeCues: [
      "hard to follow", "confusing lectures", "very confusing", "hard to understand", "doesn't explain",
      "does not explain", "rambles", "all over the place", "lectures are useless", "learn nothing from lecture",
    ],
    positivePhrase: "Explains material clearly",
    negativePhrase: "Lectures can be hard to follow",
  },
  {
    topic: "Workload",
    positiveCues: [
      "manageable workload", "light workload", "reasonable workload", "not much homework",
      "little homework", "workload is fair", "not too much work",
    ],
    negativeCues: [
      "heavy workload", "so much work", "tons of homework", "lot of homework", "lots of homework",
      "time consuming", "time-consuming", "busy work", "busywork", "overwhelming", "hours every week",
    ],
    positivePhrase: "Manageable workload",
    negativePhrase: "Heavy workload",
  },
  {
    topic: "Grading",
    positiveCues: [
      "fair grader", "grades fairly", "generous grader", "easy grader", "clear rubric",
      "rubric is published", "grading criteria are clear", "clear grading", "grading is fair",
      "lenient grader", "fair grading", "clear expectations", "expectations are clear",
      "know what to expect", "know where you stand",
    ],
    negativeCues: [
      "tough grader", "harsh grader", "unfair grading", "picky grading", "nitpick", "vague rubric",
      "arbitrary grading", "grades harshly", "harsh grading", "no rubric", "strict grader",
    ],
    positivePhrase: "Fair, predictable grading",
    negativePhrase: "Tough or unpredictable grading",
  },
  {
    topic: "Helpfulness",
    positiveCues: [
      "very helpful", "really helpful", "super helpful", "extremely helpful", "willing to help",
      "happy to help", "responds quickly", "fast response", "approachable", "answers questions",
      "cares about", "wants you to succeed", "helpful in office hours",
    ],
    negativeCues: [
      "not helpful", "unhelpful", "never responds", "doesn't respond", "does not respond",
      "unresponsive", "dismissive", "condescending", "rude", "refuses to help",
    ],
    positivePhrase: "Helpful and responsive",
    negativePhrase: "Hard to get help from",
  },
  {
    topic: "Exams",
    positiveCues: [
      "fair exams", "exams were fair", "tests were fair", "straightforward exams", "open note",
      "exams match", "tests are fair", "study guide",
    ],
    negativeCues: [
      "hard exams", "difficult exams", "exams were brutal", "tricky exams", "tests are hard",
      "nothing like the homework", "exams are impossible", "brutal exams", "test heavy",
    ],
    positivePhrase: "Fair, predictable exams",
    negativePhrase: "Difficult exams",
  },
  {
    topic: "Organization",
    positiveCues: [
      "well organized", "well-organized", "clear structure", "very organized", "syllabus is clear",
      "clearly structured", "well structured", "well-structured",
    ],
    negativeCues: [
      "disorganized", "unorganized", "no structure", "chaotic", "all over the place", "poorly organized",
    ],
    positivePhrase: "Well-organized course",
    negativePhrase: "Disorganized course",
  },
  {
    topic: "Pace",
    positiveCues: ["good pace", "reasonable pace", "paced well", "nice pace"],
    negativeCues: ["moves too fast", "moves fast", "too fast", "rushed", "fast paced", "fast-paced", "speeds through"],
    positivePhrase: "Comfortable pace",
    negativePhrase: "Moves quickly",
  },
  {
    topic: "Projects and assignments",
    positiveCues: [
      "great projects", "interesting projects", "projects were fun", "fun projects", "hands on",
      "hands-on", "assignments reinforce", "useful assignments", "projects help",
    ],
    negativeCues: [
      "pointless assignments", "useless assignments", "unclear assignments", "vague assignments",
      "pointless labs", "confusing assignments",
    ],
    positivePhrase: "Worthwhile projects",
    negativePhrase: "Unclear or unrewarding assignments",
  },
  {
    topic: "Attendance",
    positiveCues: [
      "attendance is not required", "attendance isn't required", "doesn't take attendance",
      "does not take attendance", "no attendance",
    ],
    negativeCues: [
      "attendance is mandatory", "mandatory attendance", "takes attendance", "requires attendance",
      "attendance is required", "participation matters",
    ],
    positivePhrase: "Relaxed attendance policy",
    negativePhrase: "Attendance is enforced",
  },
  {
    topic: "Course materials",
    positiveCues: [
      "uploads slides", "posts slides", "slides are helpful", "recorded lectures", "records lectures",
      "detailed slides", "posts recordings",
    ],
    negativeCues: [
      "no slides", "doesn't post slides", "does not post slides", "no recordings", "doesn't record",
    ],
    positivePhrase: "Shares slides and recordings",
    negativePhrase: "Few posted materials",
  },
];

/**
 * PolyRatings' own tag counts, used only to corroborate a topic the review text
 * already raised. Tag names not in the live vocabulary simply never match.
 */
const tagTopics: Record<string, { topic: string; negative: boolean }> = {
  "Tough Grader": { topic: "Grading", negative: true },
  "Test Heavy": { topic: "Exams", negative: true },
  "Lots Of Homework": { topic: "Workload", negative: true },
  "Attendance Mandatory": { topic: "Attendance", negative: true },
  "Participation Matters": { topic: "Attendance", negative: true },
  "Graded By Few Things": { topic: "Grading", negative: true },
  "Uploads Slides": { topic: "Course materials", negative: false },
  "Class Handouts": { topic: "Course materials", negative: false },
  "Recorded Lectures": { topic: "Course materials", negative: false },
  "Fast Response Time": { topic: "Helpfulness", negative: false },
  "High In-Person Availability": { topic: "Helpfulness", negative: false },
  "Accessible Outside Class": { topic: "Helpfulness", negative: false },
  "Extra Credit": { topic: "Grading", negative: false },
};

const negators = ["not", "never", "no", "isn't", "wasn't", "aren't", "doesn't", "didn't", "don't", "hardly", "barely"];
const negationWindow = 22;

function containsNegator(value: string): boolean {
  return negators.some((word) => new RegExp(`\\b${word.replace("'", "'?")}\\b`).test(value));
}

/**
 * A cue that already carries its own negation ("not much homework") must not be
 * flipped again by the preceding-window check.
 */
function cueIsSelfNegating(cue: string): boolean {
  return containsNegator(cue);
}

function cueMatches(text: string, cue: string): { matched: boolean; flipped: boolean } {
  const index = text.indexOf(cue);
  if (index === -1) return { matched: false, flipped: false };
  if (cueIsSelfNegating(cue)) return { matched: true, flipped: false };

  const preceding = text.slice(Math.max(0, index - negationWindow), index);
  return { matched: true, flipped: containsNegator(preceding) };
}

interface TopicTally {
  positive: number;
  negative: number;
}

function tallyReview(text: string, tallies: Map<string, TopicTally>): void {
  const haystack = text.toLowerCase();

  for (const definition of topicDefinitions) {
    let positive = false;
    let negative = false;

    for (const cue of definition.positiveCues) {
      const { matched, flipped } = cueMatches(haystack, cue);
      if (!matched) continue;
      if (flipped) negative = true;
      else positive = true;
    }

    for (const cue of definition.negativeCues) {
      const { matched, flipped } = cueMatches(haystack, cue);
      if (!matched) continue;
      if (flipped) positive = true;
      else negative = true;
    }

    if (!positive && !negative) continue;
    const tally = tallies.get(definition.topic) ?? { positive: 0, negative: 0 };
    // One review counts once per topic, so a repeated phrase cannot inflate a theme.
    if (positive) tally.positive += 1;
    if (negative) tally.negative += 1;
    tallies.set(definition.topic, tally);
  }
}

/** Below this, a single opinionated reviewer would otherwise read as a pattern. */
const limitedEvidenceThreshold = 4;
const corroboratedCorpusSize = 6;
const maxThemes = 4;
const maxListed = 3;

export function synthesizeReviews(professor: Professor, reviews: ProfessorReview[]): ReviewSynthesis {
  const usable = reviews.filter((review) => typeof review.text === "string" && review.text.trim().length > 0);

  if (usable.length === 0) {
    return {
      overview: "No review text is available to summarize yet.",
      themes: [],
      strengths: [],
      concerns: [],
      reviewsAnalyzed: 0,
      hasLimitedEvidence: true,
    };
  }

  const tallies = new Map<string, TopicTally>();
  for (const review of usable) tallyReview(review.text, tallies);

  for (const tag of professor.tags) {
    const mapping = tagTopics[tag];
    // Tags corroborate a topic the reviews already raised; they never introduce one.
    if (!mapping || !tallies.has(mapping.topic)) continue;
    const tally = tallies.get(mapping.topic)!;
    if (mapping.negative) tally.negative += 1;
    else tally.positive += 1;
  }

  // A larger corpus can afford to demand corroboration before calling something recurring.
  const minMentions = usable.length >= corroboratedCorpusSize ? 2 : 1;

  const themes: ReviewTheme[] = [];
  const strengths: string[] = [];
  const concerns: string[] = [];

  for (const definition of topicDefinitions) {
    const tally = tallies.get(definition.topic);
    if (!tally) continue;

    const mentions = Math.max(tally.positive, tally.negative);
    if (mentions < minMentions) continue;

    const sentiment: ThemeSentiment =
      tally.positive > 0 && tally.negative > 0 ? "mixed" : tally.positive > 0 ? "positive" : "negative";

    themes.push({
      topic: definition.topic,
      sentiment,
      mentions,
      positiveMentions: tally.positive,
      negativeMentions: tally.negative,
    });

    if (tally.positive >= minMentions && tally.positive > tally.negative) strengths.push(definition.positivePhrase);
    if (tally.negative >= minMentions && tally.negative > tally.positive) concerns.push(definition.negativePhrase);
  }

  themes.sort((left, right) => right.mentions - left.mentions || left.topic.localeCompare(right.topic));

  const hasLimitedEvidence = usable.length < limitedEvidenceThreshold;

  return {
    overview: buildOverview(usable.length, themes, hasLimitedEvidence),
    themes: themes.slice(0, maxThemes),
    strengths: strengths.slice(0, maxListed),
    concerns: concerns.slice(0, maxListed),
    reviewsAnalyzed: usable.length,
    hasLimitedEvidence,
  };
}

function buildOverview(reviewCount: number, themes: ReviewTheme[], hasLimitedEvidence: boolean): string {
  const noun = reviewCount === 1 ? "review" : "reviews";

  if (themes.length === 0) {
    return `Read ${reviewCount} ${noun}, but no topic came up often enough to call it a pattern.`;
  }

  const leading = formatList(themes.slice(0, maxListed).map((theme) => theme.topic.toLowerCase()));
  const sentences = [`Across ${reviewCount} ${noun}, students most often mention ${leading}.`];

  if (hasLimitedEvidence) {
    sentences.push(`That is only ${reviewCount} ${noun}, so treat this as a weak signal.`);
  }

  return sentences.join(" ");
}
