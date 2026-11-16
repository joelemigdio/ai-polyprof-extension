import { describe, expect, it } from "vitest";
import type { Professor, ProfessorReview } from "../models/professor";
import { synthesizeReviews } from "./review-synthesis";

function professor(overrides: Partial<Professor> = {}): Professor {
  return {
    id: "test",
    name: "Test Professor",
    firstName: "Test",
    lastName: "Professor",
    department: "CSC",
    courses: ["CSC 101"],
    starRating: 3.2,
    clarityRating: 3.2,
    supportRating: 3,
    reviewCount: 10,
    tags: [],
    traits: [],
    weakTraits: [],
    reviews: [],
    ...overrides,
  };
}

function reviews(...texts: string[]): ProfessorReview[] {
  return texts.map((text, index) => ({
    id: `review-${index}`,
    courseCode: "CSC 357",
    classYear: "Junior",
    rating: 3,
    text,
    grade: "A",
    courseType: "Major (Required)",
    postDate: "2026-01-15T00:00:00.000Z",
  }));
}

function topicNames(synthesis: ReturnType<typeof synthesizeReviews>): string[] {
  return synthesis.themes.map((theme) => theme.topic);
}

describe("synthesizeReviews", () => {
  it("reports no evidence when there is no review text", () => {
    const result = synthesizeReviews(professor(), []);

    expect(result.reviewsAnalyzed).toBe(0);
    expect(result.themes).toEqual([]);
    expect(result.strengths).toEqual([]);
    expect(result.concerns).toEqual([]);
    expect(result.hasLimitedEvidence).toBe(true);
    expect(result.overview).toMatch(/No review text/i);
  });

  it("ignores reviews whose text is blank", () => {
    const result = synthesizeReviews(professor(), reviews("   ", ""));

    expect(result.reviewsAnalyzed).toBe(0);
  });

  it("separates strengths from concerns across a corpus", () => {
    const result = synthesizeReviews(
      professor(),
      reviews(
        "He explains well and is very helpful during office hours.",
        "Explains clearly, though it is a heavy workload.",
        "Very helpful and answers questions, but tons of homework every week.",
        "Great explanations. Still, so much work outside class.",
      ),
    );

    expect(result.strengths).toContain("Explains material clearly");
    expect(result.strengths).toContain("Helpful and responsive");
    expect(result.concerns).toContain("Heavy workload");
    expect(result.concerns).not.toContain("Manageable workload");
  });

  it("counts a topic once per review even when a cue repeats", () => {
    const result = synthesizeReviews(
      professor(),
      reviews("Tough grader. Really a tough grader, and the harsh grading never let up."),
    );

    const grading = result.themes.find((theme) => theme.topic === "Grading");
    expect(grading?.negativeMentions).toBe(1);
  });

  it("flips a positive cue that is negated in the sentence", () => {
    const result = synthesizeReviews(
      professor(),
      reviews("He is not very helpful.", "Honestly not very helpful at all."),
    );

    expect(result.concerns).toContain("Hard to get help from");
    expect(result.strengths).not.toContain("Helpful and responsive");
  });

  it("does not double-flip a cue that already contains its own negation", () => {
    const result = synthesizeReviews(
      professor(),
      reviews("There is not much homework.", "Seriously, not much homework in this class."),
    );

    expect(result.strengths).toContain("Manageable workload");
    expect(result.concerns).not.toContain("Heavy workload");
  });

  it("marks a topic mixed when reviewers disagree", () => {
    const result = synthesizeReviews(
      professor(),
      reviews("Exams were fair and matched the homework.", "Brutal exams that were nothing like the homework."),
    );

    const exams = result.themes.find((theme) => theme.topic === "Exams");
    expect(exams?.sentiment).toBe("mixed");
    expect(result.strengths).not.toContain("Fair, predictable exams");
    expect(result.concerns).not.toContain("Difficult exams");
  });

  it("requires corroboration once the corpus is large enough", () => {
    const filler = Array.from({ length: 6 }, () => "The room was cold and the chairs squeaked.");
    const result = synthesizeReviews(professor(), reviews(...filler, "Tough grader."));

    expect(topicNames(result)).not.toContain("Grading");
  });

  it("accepts a single mention when the corpus is small", () => {
    const result = synthesizeReviews(professor(), reviews("Tough grader."));

    expect(topicNames(result)).toContain("Grading");
    expect(result.hasLimitedEvidence).toBe(true);
    expect(result.overview).toMatch(/weak signal/i);
  });

  it("lets PolyRatings tags corroborate a topic the reviews already raised", () => {
    const withoutTag = synthesizeReviews(
      professor(),
      reviews("Tough grader.", "The lectures were fine.", "Nothing special.", "It was okay.", "Fine class.", "Average."),
    );
    const withTag = synthesizeReviews(
      professor({ tags: ["Tough Grader"] }),
      reviews("Tough grader.", "The lectures were fine.", "Nothing special.", "It was okay.", "Fine class.", "Average."),
    );

    expect(topicNames(withoutTag)).not.toContain("Grading");
    expect(topicNames(withTag)).toContain("Grading");
  });

  it("never introduces a topic that no review mentioned", () => {
    const result = synthesizeReviews(
      professor({ tags: ["Tough Grader", "Test Heavy", "Lots Of Homework"] }),
      reviews("The room was cold.", "Chairs squeaked."),
    );

    expect(result.themes).toEqual([]);
    expect(result.concerns).toEqual([]);
  });

  it("says so when nothing recurs rather than inventing a theme", () => {
    const result = synthesizeReviews(professor(), reviews("The room was cold.", "Chairs squeaked."));

    expect(result.overview).toMatch(/no topic came up often enough/i);
  });

  it("names the leading themes in the overview", () => {
    const result = synthesizeReviews(
      professor(),
      reviews("Heavy workload but he explains well.", "He explains well despite the heavy workload."),
    );

    expect(result.overview).toMatch(/lecture clarity|workload/i);
    expect(result.reviewsAnalyzed).toBe(2);
  });
});
