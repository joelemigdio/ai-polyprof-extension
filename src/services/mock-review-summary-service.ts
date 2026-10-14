import type { ProfessorReview } from "../models/professor";
import type { ReviewInsights, ReviewSummaryService } from "./review-summary-service";

const minimumThemeOccurrences = 2;
const strengthThemes = new Set([
  "Clear lectures",
  "Helpful feedback",
  "Approachable",
  "Flexible grading",
  "Practical examples",
]);
const concernThemes = new Set(["Challenging workload", "Exam preparation required"]);

function getRecurringThemes(reviews: ProfessorReview[]): string[] {
  const counts = new Map<string, number>();

  for (const review of reviews) {
    for (const tag of review.tags ?? []) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .filter(([, count]) => count >= minimumThemeOccurrences)
    .sort(([, leftCount], [, rightCount]) => rightCount - leftCount)
    .map(([theme]) => theme)
    .slice(0, 5);
}

function formatList(items: string[]): string {
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items.at(-1)}`;
}

function createSummary(reviews: ProfessorReview[], themes: string[], averageRating: number | null): string | null {
  if (reviews.length === 0) return null;

  const sentences = [
    `The ${reviews.length} available demo review${reviews.length === 1 ? "" : "s"} average ${averageRating?.toFixed(1) ?? "an unavailable rating"} out of 5.`,
  ];
  const strengths = themes.filter((theme) => strengthThemes.has(theme));
  const concerns = themes.filter((theme) => concernThemes.has(theme));

  if (strengths.length > 0) {
    sentences.push(`Recurring strengths include ${formatList(strengths)}.`);
  }
  if (concerns.length > 0) {
    sentences.push(`Recurring considerations include ${formatList(concerns)}.`);
  }
  if (themes.length === 0) {
    sentences.push("No theme appears in at least two available reviews, so no recurring pattern is shown.");
  }

  return sentences.join(" ");
}

/** Deterministic, tag-count based demo implementation; it makes no AI or network calls. */
export const mockReviewSummaryService: ReviewSummaryService = {
  getInsights(reviews: ProfessorReview[]): ReviewInsights {
    const usableReviews = reviews.filter((review) => Boolean(review));
    const ratedReviews = usableReviews.filter((review) => Number.isFinite(review.rating));
    const averageRating = ratedReviews.length > 0
      ? ratedReviews.reduce((total, review) => total + review.rating, 0) / ratedReviews.length
      : null;
    const themes = getRecurringThemes(usableReviews);

    return {
      summary: createSummary(usableReviews, themes, averageRating),
      themes,
      reviewCount: usableReviews.length,
      averageRating,
    };
  },
};
