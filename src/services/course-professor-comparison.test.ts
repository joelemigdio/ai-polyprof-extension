import { describe, expect, it } from "vitest";
import type { CourseInstructor, Professor } from "../models/professor";
import { createDefaultPreferences } from "../models/preferences";
import { buildCourseProfessorComparisons, recommendCourseProfessor } from "./course-professor-comparison";

function professor(overrides: Partial<Professor> = {}): Professor {
  return {
    id: "ada",
    name: "Ada Lovelace",
    firstName: "Ada",
    lastName: "Lovelace",
    department: "CSC",
    courses: ["CSC 4880"],
    starRating: 3.6,
    clarityRating: 3.4,
    supportRating: 3.2,
    reviewCount: 2,
    tags: [],
    traits: ["project-heavy"],
    weakTraits: [],
    reviews: [],
    ...overrides,
  };
}

const visibleInstructors: CourseInstructor[] = [
  { instructorName: "Dr. Ada Lovelace", displayName: "Dr. Ada Lovelace", source: "currently-visible-section" },
  { instructorName: "Dr. Grace Hopper", displayName: "Dr. Grace Hopper", source: "currently-visible-section" },
];

describe("course professor comparison", () => {
  it("matches provider-backed ratings to instructors currently visible in Student Center", () => {
    const comparisons = buildCourseProfessorComparisons(
      visibleInstructors,
      [professor(), professor({ id: "grace", name: "Grace Hopper", firstName: "Grace", lastName: "Hopper", starRating: 4, clarityRating: 4, reviewCount: 8, traits: ["labs"] })],
      { ...createDefaultPreferences(), learningStyles: ["project-heavy"] },
    );

    expect(comparisons).toHaveLength(2);
    expect(comparisons[0]).toMatchObject({ overallRating: 3.6, reviewCount: 2, preferenceFit: 96, matchedTraits: ["project-heavy"] });
    expect(comparisons[1]).toMatchObject({ overallRating: 4, reviewCount: 8, preferenceFit: 35, matchedTraits: [] });
  });

  it("recommends the highest preference fit before a higher overall rating", () => {
    const comparisons = buildCourseProfessorComparisons(
      visibleInstructors,
      [professor(), professor({ id: "grace", name: "Grace Hopper", firstName: "Grace", lastName: "Hopper", starRating: 4, clarityRating: 4, reviewCount: 8, traits: ["labs"] })],
      { ...createDefaultPreferences(), learningStyles: ["project-heavy"] },
    );

    expect(recommendCourseProfessor(comparisons)?.professorId).toBe("ada");
  });

  it("keeps an unmatched visible instructor honest instead of inventing a rating", () => {
    const comparisons = buildCourseProfessorComparisons(
      [{ instructorName: "Professor Not In API", displayName: "Professor Not In API", source: "currently-visible-section" }],
      [professor()],
      createDefaultPreferences(),
    );

    expect(comparisons[0]).toMatchObject({ professorId: null, overallRating: null, preferenceFit: null });
    expect(recommendCourseProfessor(comparisons)).toBeNull();
  });
});
