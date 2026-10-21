import { describe, expect, it } from "vitest";
import type { Professor } from "../models/professor";
import { findConfidentProfessor, parseInstructorName } from "./professor-detection";

function professor(firstName: string, lastName: string, overrides: Partial<Professor> = {}): Professor {
  return {
    id: `${firstName}-${lastName}`.toLowerCase(),
    name: `${firstName} ${lastName}`,
    firstName,
    lastName,
    department: "CSC",
    courses: [],
    starRating: 3,
    clarityRating: 3,
    supportRating: 3,
    reviewCount: 10,
    tags: [],
    traits: [],
    weakTraits: [],
    reviews: [],
    ...overrides,
  };
}

describe("parseInstructorName", () => {
  it("reads the PeopleSoft surname-first form, including a middle initial", () => {
    expect(parseInstructorName("Kurfess,Franz J")).toEqual({ first: "Franz", last: "Kurfess" });
    expect(parseInstructorName("Kurfess, Franz")).toEqual({ first: "Franz", last: "Kurfess" });
  });

  it("reads given-name-first forms and drops honorifics and suffixes", () => {
    expect(parseInstructorName("Franz Kurfess")).toEqual({ first: "Franz", last: "Kurfess" });
    expect(parseInstructorName("Dr. Franz Kurfess")).toEqual({ first: "Franz", last: "Kurfess" });
    expect(parseInstructorName("Franz J Kurfess")).toEqual({ first: "Franz", last: "Kurfess" });
    expect(parseInstructorName("Kurfess, Franz Jr")).toEqual({ first: "Franz", last: "Kurfess" });
  });

  it("treats a lone token as a surname and rejects empty input", () => {
    expect(parseInstructorName("Kurfess")).toEqual({ first: "", last: "Kurfess" });
    expect(parseInstructorName("   ")).toBeNull();
  });
});

describe("findConfidentProfessor", () => {
  const kurfess = professor("Franz", "Kurfess");
  const wood = professor("Zoë", "Wood");
  const roster = [kurfess, wood, professor("John", "Clements")];

  it("matches the portal's surname-first format against separate name fields", () => {
    expect(findConfidentProfessor("Kurfess,Franz J", roster)).toBe(kurfess);
    expect(findConfidentProfessor("Dr. Franz Kurfess", roster)).toBe(kurfess);
  });

  it("ignores diacritics so the portal's plain spelling still resolves", () => {
    expect(findConfidentProfessor("Wood,Zoe", roster)).toBe(wood);
  });

  it("accepts an initial in place of a given name", () => {
    expect(findConfidentProfessor("Kurfess,F", roster)).toBe(kurfess);
  });

  it("matches a bare surname only when it is unique", () => {
    expect(findConfidentProfessor("Kurfess", roster)).toBe(kurfess);
    const shared = [professor("Chris", "Clark"), professor("Dana", "Clark")];
    expect(findConfidentProfessor("Clark", shared)).toBeNull();
  });

  it("refuses to guess between different people who share a full name", () => {
    const clashing = [professor("Chris", "Clark"), professor("Chris", "Clark", { id: "other", department: "CRP" })];
    expect(findConfidentProfessor("Clark,Chris", clashing)).toBeNull();
  });

  it("returns null when nobody matches", () => {
    expect(findConfidentProfessor("Nobody,Here", roster)).toBeNull();
  });
});
