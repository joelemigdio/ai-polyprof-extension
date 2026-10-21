import { describe, expect, it } from "vitest";
import { courseAliases, courseTitle, findCourseCodes, isKnownCourseCode, normalizeCourseCode } from "./course-crosswalk";

describe("normalizeCourseCode", () => {
  it("accepts the spacing and casing variants the portal renders", () => {
    expect(normalizeCourseCode("CSC 3449")).toBe("CSC 3449");
    expect(normalizeCourseCode("csc3449")).toBe("CSC 3449");
    expect(normalizeCourseCode("CSC-3449")).toBe("CSC 3449");
    expect(normalizeCourseCode("Course: csc 3449 (4 units)")).toBe("CSC 3449");
  });

  it("keeps a trailing section letter and returns null when there is no course code", () => {
    expect(normalizeCourseCode("CSC 2001L")).toBe("CSC 2001L");
    expect(normalizeCourseCode("MWF 9:00-10:00")).toBeNull();
    expect(normalizeCourseCode("Section 01")).toBeNull();
  });

  it("lists every candidate so a caller can pick the one the catalog knows", () => {
    expect(findCourseCodes("Room 180 Bldg 14 CSC 3449")).toContain("CSC 3449");
  });
});

describe("quarter to semester mappings", () => {
  // Hand-checked against catalog.calpoly.edu; the renumbering was not arithmetic,
  // so these guard against a bad regeneration of the data file.
  it.each([
    ["CSC 357", "CSC 2050"],
    ["CSC 349", "CSC 3449"],
    ["CSC 480", "CSC 4880"],
    ["CSC 308", "CSC 3100"],
    ["CSC 202", "CSC 2001"],
    ["CSC 430", "CSC 3300"],
    ["CSC 471", "CSC 4710"],
  ])("maps %s to %s in both directions", (quarterCode, semesterCode) => {
    expect(courseAliases(quarterCode)).toContain(semesterCode);
    expect(courseAliases(semesterCode)).toContain(quarterCode);
  });

  it("does not invent a mapping by prepending the first digit", () => {
    expect(courseAliases("CSC 349")).not.toContain("CSC 3349");
    expect(courseAliases("CSC 480")).not.toContain("CSC 4480");
  });

  it("resolves a cross-listed predecessor under both departments", () => {
    expect(courseAliases("CSC 2001")).toEqual(expect.arrayContaining(["CSC 202", "CPE 202"]));
  });

  it("always includes the code it was given, even when unmapped", () => {
    expect(courseAliases("CSC 9999")).toEqual(["CSC 9999"]);
  });

  it("titles semester courses from the catalog", () => {
    expect(courseTitle("CSC 3449")).toBe("Algorithms and Complexity");
    expect(courseTitle("CSC 9999")).toBeUndefined();
  });

  it("recognizes real codes and rejects lookalikes", () => {
    expect(isKnownCourseCode("CSC 3449")).toBe(true);
    expect(isKnownCourseCode("CSC 357")).toBe(true);
    expect(isKnownCourseCode("FALL 2026")).toBe(false);
    expect(isKnownCourseCode("ROOM 1420")).toBe(false);
  });
});
