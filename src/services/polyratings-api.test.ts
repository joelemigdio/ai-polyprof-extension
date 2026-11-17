import { describe, expect, it } from "vitest";
import { professorDetailUrl, toProfessor, unwrapTrpc, type RawProfessor, type RawTruncatedProfessor } from "./polyratings-api";

function raw(overrides: Partial<RawTruncatedProfessor> = {}): RawTruncatedProfessor {
  return {
    id: "abc-123",
    department: "CSC",
    firstName: "Ada",
    lastName: "Lovelace",
    numEvals: 12,
    overallRating: 3.6,
    materialClear: 3.4,
    studentDifficulties: 3.2,
    courses: ["CSC 357"],
    ...overrides,
  };
}

describe("unwrapTrpc", () => {
  it("returns the payload from a successful response", () => {
    expect(unwrapTrpc<number[]>({ result: { data: [1, 2] } })).toEqual([1, 2]);
  });

  it("throws the server's message when the response carries an error", () => {
    expect(() => unwrapTrpc({ error: { message: "nope" } })).toThrow("nope");
  });

  it("throws even when the error has no message", () => {
    expect(() => unwrapTrpc({ error: {} })).toThrow(/failed/i);
  });

  it("throws rather than returning undefined when data is absent", () => {
    expect(() => unwrapTrpc({ result: {} })).toThrow(/no data/i);
  });

  it("treats a falsy-but-present payload as valid data", () => {
    expect(unwrapTrpc<number>({ result: { data: 0 } })).toBe(0);
  });
});

describe("professorDetailUrl", () => {
  it("encodes the id into a tRPC input parameter", () => {
    const url = professorDetailUrl("abc-123");

    expect(url).toContain("professors.get?input=");
    expect(decodeURIComponent(url)).toContain('{"id":"abc-123"}');
  });

  it("escapes characters that would otherwise break the query string", () => {
    expect(professorDetailUrl('a&b="c"')).not.toContain('"');
  });
});

describe("toProfessor", () => {
  it("maps PolyRatings scores onto the extension's field names", () => {
    const professor = toProfessor(raw());

    expect(professor.name).toBe("Ada Lovelace");
    expect(professor.starRating).toBe(3.6);
    expect(professor.clarityRating).toBe(3.4);
    expect(professor.supportRating).toBe(3.2);
    expect(professor.reviewCount).toBe(12);
  });

  it("collapses stray whitespace in a joined name", () => {
    expect(toProfessor(raw({ firstName: "Ada  ", lastName: "  Lovelace" })).name).toBe("Ada Lovelace");
  });

  it("leaves reviews empty for an index record", () => {
    expect(toProfessor(raw()).reviews).toEqual([]);
  });

  it("orders tags by citation count, most cited first", () => {
    const professor = toProfessor(raw({ tags: { "Tough Grader": 2, "Uploads Slides": 9 } }));

    expect(professor.tags).toEqual(["Uploads Slides", "Tough Grader"]);
  });

  it("derives a trait only once a tag is corroborated by more than one reviewer", () => {
    expect(toProfessor(raw({ tags: { "Uploads Slides": 1 } })).traits).toEqual([]);
    expect(toProfessor(raw({ tags: { "Uploads Slides": 2 } })).traits).toContain("visual-slides");
  });

  it("records a tag that signals the absence of a trait as a weakness", () => {
    const professor = toProfessor(raw({ tags: { "Flexible Deadline Policy": 4 } }));

    expect(professor.weakTraits).toContain("structured");
    expect(professor.traits).not.toContain("structured");
  });

  it("trusts neither side when tags report a trait both ways", () => {
    const professor = toProfessor(
      raw({ tags: { "Inflexible Deadline Policy": 3, "Flexible Deadline Policy": 3 } }),
    );

    expect(professor.weakTraits).not.toContain("structured");
    expect(professor.traits).toContain("structured");
  });

  it("ignores tags outside the known vocabulary", () => {
    const professor = toProfessor(raw({ tags: { "Invented Tag": 9 } }));

    expect(professor.traits).toEqual([]);
    expect(professor.tags).toEqual(["Invented Tag"]);
  });

  it("flattens course-keyed reviews and orders them most recent first", () => {
    const detail: RawProfessor = {
      ...raw(),
      reviews: {
        "CSC 357": [
          {
            id: "old",
            grade: "B",
            gradeLevel: "Sophomore",
            courseType: "Major (Required)",
            overallRating: 3,
            presentsMaterialClearly: 3,
            recognizesStudentDifficulties: 3,
            rating: "Older review.",
            postDate: "2024-01-01T00:00:00.000Z",
          },
        ],
        "CSC 101": [
          {
            id: "new",
            grade: "A",
            gradeLevel: "Junior",
            courseType: "Elective",
            overallRating: 4,
            presentsMaterialClearly: 4,
            recognizesStudentDifficulties: 4,
            rating: "Newer review.",
            postDate: "2026-01-01T00:00:00.000Z",
          },
        ],
      },
    };

    const professor = toProfessor(detail);

    expect(professor.reviews.map((review) => review.id)).toEqual(["new", "old"]);
    expect(professor.reviews[0].courseCode).toBe("CSC 101");
    expect(professor.reviews[0].classYear).toBe("Junior");
    expect(professor.reviews[0].text).toBe("Newer review.");
  });

  it("handles a detail record with no reviews at all", () => {
    expect(toProfessor({ ...raw(), reviews: {} } as RawProfessor).reviews).toEqual([]);
  });
});
