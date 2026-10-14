/**
 * Future server-side boundary for AI review summaries. No API key or AI call is
 * included in the extension: keys must never be shipped in a browser bundle.
 */
export interface AiSummaryService {
  summarizeReviews(reviewText: string[]): Promise<string>;
}
