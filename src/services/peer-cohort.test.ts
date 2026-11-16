import { describe, expect, it } from "vitest";
import type { Professor, ProfessorReview } from "../models/professor";
import { createDefaultPreferences } from "../models/preferences";
import { buildCoursePeerAggregate, buildPeerAggregate, minimumCohortSize } from "./peer-cohort";
import { buildRecommendationExplanation } from "./recommendation-explanation";

function reviews(entries: Array<[string, number]>): ProfessorReview[] {
  return entries.map(([classYear, rating], index) => ({
    id: `r${index}`,
    courseCode: "CSC 357",
    classYear,
    rating,
    text: "Review text.",
    grade: "A",
    courseType: "Major (Required)",
    postDate: "2026-01-15T00:00:00.000Z",
  }));
}

function professor(overrides: Partial<Professor> = {}): Professor {
  return {
    id: "ada",
    name: "Ada Lovelace",
    firstName: "Ada",
    lastName: "Lovelace",
    department: "CSC",
    courses: ["CSC 357"],
    starRating: 3.2,
    clarityRating: 3.2,
    supportRating: 3,
    reviewCount: 0,
    tags: [],
    traits: [],
    weakTraits: [],
    reviews: [],
    ...overrides,
  };
}

describe("buildPeerAggregate", () => {
  it("uses the student's own year when enough reviewers share it", () => {
    const result = buildPeerAggregate(
      reviews([["Junior", 4], ["Junior", 4], ["Junior", 1], ["Senior", 1]]),
      "Junior",
    );

    expect(result.tier).toBe("same-year");
    expect(result.label).toBe("juniors");
    expect(result.sampleSize).toBe(3);
    expect(result.totalReviews).toBe(4);
    expect(result.rating).toBeCloseTo(3);
    expect(result.widened).toBe(false);
  });

  it("widens to neighbouring years when the exact year is too small", () => {
    const result = buildPeerAggregate(
      reviews([["Junior", 4], ["Sophomore", 3], ["Senior", 2]]),
      "Junior",
    );

    expect(result.tier).toBe("adjacent-year");
    expect(result.widened).toBe(true);
    expect(result.sampleSize).toBe(3);
  });

  it("does not treat a distant year as adjacent", () => {
    const result = buildPeerAggregate(
      reviews([["Freshman", 4], ["Freshman", 4], ["Freshman", 4]]),
      "Senior",
    );

    expect(result.tier).toBe("all-reviewers");
  });

  it("falls back to everyone when no cohort reaches the threshold", () => {
    const result = buildPeerAggregate(
      reviews([["Freshman", 4], ["Grad Student", 2]]),
      "Senior",
    );

    expect(result.tier).toBe("all-reviewers");
    expect(result.sampleSize).toBe(2);
    expect(result.widened).toBe(true);
  });

  it("withholds a cohort smaller than the re-identification threshold", () => {
    const justUnder = Array.from({ length: minimumCohortSize - 1 }, () => ["Junior", 4] as [string, number]);
    const result = buildPeerAggregate(reviews([...justUnder, ["Freshman", 1]]), "Junior");

    expect(result.tier).not.toBe("same-year");
  });

  it("uses everyone when the student has not given a class standing", () => {
    const result = buildPeerAggregate(reviews([["Junior", 4], ["Junior", 4], ["Junior", 4]]), null);

    expect(result.tier).toBe("all-reviewers");
    expect(result.widened).toBe(false);
  });

  it("grades confidence by sample size", () => {
    const many = Array.from({ length: 12 }, () => ["Junior", 3] as [string, number]);
    const few = Array.from({ length: 6 }, () => ["Junior", 3] as [string, number]);
    const barely = Array.from({ length: 3 }, () => ["Junior", 3] as [string, number]);

    expect(buildPeerAggregate(reviews(many), "Junior").confidence).toBe("high");
    expect(buildPeerAggregate(reviews(few), "Junior").confidence).toBe("moderate");
    expect(buildPeerAggregate(reviews(barely), "Junior").confidence).toBe("low");
  });

  it("reports no rating when there are no reviews at all", () => {
    const result = buildPeerAggregate([], "Junior");

    expect(result.rating).toBeNull();
    expect(result.sampleSize).toBe(0);
  });
});

describe("buildCoursePeerAggregate", () => {
  it("treats an index-only record as the whole-corpus aggregate rather than unrated", () => {
    const result = buildCoursePeerAggregate(
      professor({ reviews: [], reviewCount: 61, starRating: 3.6 }),
      [],
      "Junior",
    );

    expect(result.rating).toBe(3.6);
    expect(result.sampleSize).toBe(61);
    expect(result.tier).toBe("all-reviewers");
  });

  it("scopes to the course when it has enough history", () => {
    const scoped = reviews([["Junior", 4], ["Junior", 4], ["Junior", 4]]);
    const other = reviews([["Junior", 1]]).map((review) => ({ ...review, courseCode: "CSC 101" }));
    const result = buildCoursePeerAggregate(
      professor({ reviews: [...scoped, ...other], reviewCount: 4 }),
      ["CSC 357"],
      "Junior",
    );

    expect(result.rating).toBeCloseTo(4);
    expect(result.sampleSize).toBe(3);
  });

  it("falls back to the full record when the course has too little history", () => {
    const all = reviews([["Junior", 4], ["Junior", 2], ["Junior", 3]]);
    all[0].courseCode = "CSC 357";
    all[1].courseCode = "CSC 101";
    all[2].courseCode = "CSC 101";

    const result = buildCoursePeerAggregate(
      professor({ reviews: all, reviewCount: 3 }),
      ["CSC 357"],
      "Junior",
    );

    expect(result.sampleSize).toBe(3);
  });
});

describe("buildRecommendationExplanation", () => {
  const preferences = { ...createDefaultPreferences(), classStanding: "Junior" as const };

  it("reports all four required elements", () => {
    const result = buildRecommendationExplanation(
      professor({ reviews: reviews([["Junior", 4], ["Junior", 3], ["Junior", 4], ["Senior", 1]]), reviewCount: 4, traits: ["responsive"] }),
      preferences,
    );

    expect(result.basis).toBe("juniors");
    expect(result.peerRating).toBeCloseTo(3.667, 2);
    expect(result.sampleSize).toBe(3);
    expect(result.preferenceFactors).toContain("responsive to questions");
  });

  it("names the cohort and sample size in the headline", () => {
    const result = buildRecommendationExplanation(
      professor({ reviews: reviews([["Junior", 4], ["Junior", 4], ["Junior", 4], ["Senior", 2]]), reviewCount: 4 }),
      preferences,
    );

    expect(result.headline).toContain("Juniors");
    expect(result.headline).toContain("3 of 4 reviews");
  });

  it("asks for a class standing when none is set", () => {
    const result = buildRecommendationExplanation(
      professor({ reviews: reviews([["Junior", 4]]), reviewCount: 1 }),
      createDefaultPreferences(),
    );

    expect(result.caveat).toContain("class standing");
  });

  it("discloses when the cohort had to be widened", () => {
    const result = buildRecommendationExplanation(
      professor({ reviews: reviews([["Junior", 4], ["Sophomore", 3], ["Senior", 2]]), reviewCount: 3 }),
      preferences,
    );

    expect(result.caveat).toContain("nearby years");
  });

  it("marks a thin same-year cohort as low confidence", () => {
    const result = buildRecommendationExplanation(
      professor({ reviews: reviews([["Junior", 4], ["Junior", 3], ["Junior", 4]]), reviewCount: 3 }),
      preferences,
    );

    expect(result.confidence).toBe("low");
    expect(result.caveat).toContain("weak signal");
  });

  it("does not caveat a large same-year cohort", () => {
    const many = Array.from({ length: 14 }, () => ["Junior", 3] as [string, number]);
    const result = buildRecommendationExplanation(
      professor({ reviews: reviews(many), reviewCount: 14 }),
      preferences,
    );

    expect(result.confidence).toBe("high");
    expect(result.caveat).toBeNull();
  });
});
