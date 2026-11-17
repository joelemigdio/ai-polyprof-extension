import { describe, expect, it } from "vitest";
import { createDefaultPreferences } from "../models/preferences";
import { normalizePreferences } from "./preference-storage";

const defaults = createDefaultPreferences();

describe("normalizePreferences", () => {
  it("returns defaults for anything that is not an object", () => {
    expect(normalizePreferences(undefined)).toEqual(defaults);
    expect(normalizePreferences(null)).toEqual(defaults);
    expect(normalizePreferences("junior")).toEqual(defaults);
    expect(normalizePreferences(7)).toEqual(defaults);
  });

  it("keeps a fully valid stored value intact", () => {
    const stored = {
      version: 2,
      departments: ["CSC"],
      classStanding: "Junior",
      classTimes: ["evening"],
      learningStyles: ["responsive", "structured"],
    };

    expect(normalizePreferences(stored)).toEqual(stored);
  });

  it("preserves learning-style order, since that order is the ranking", () => {
    const first = normalizePreferences({ learningStyles: ["structured", "responsive", "visual-slides"] });
    const second = normalizePreferences({ learningStyles: ["visual-slides", "responsive", "structured"] });

    expect(first.learningStyles).toEqual(["structured", "responsive", "visual-slides"]);
    expect(second.learningStyles).toEqual(["visual-slides", "responsive", "structured"]);
  });

  it("drops unknown entries rather than failing the whole load", () => {
    const result = normalizePreferences({
      departments: ["CSC", "BASKETWEAVING"],
      learningStyles: ["responsive", "telepathy"],
      classTimes: ["evening", "midnight"],
    });

    expect(result.departments).toEqual(["CSC"]);
    expect(result.learningStyles).toEqual(["responsive"]);
    expect(result.classTimes).toEqual(["evening"]);
  });

  it("keeps an explicitly emptied list empty instead of restoring defaults", () => {
    const result = normalizePreferences({ departments: [], learningStyles: [], classTimes: [] });

    expect(result.departments).toEqual([]);
    expect(result.learningStyles).toEqual([]);
    expect(result.classTimes).toEqual([]);
  });

  it("falls back to defaults when a list is the wrong type entirely", () => {
    const result = normalizePreferences({ departments: "CSC", learningStyles: 5 });

    expect(result.departments).toEqual(defaults.departments);
    expect(result.learningStyles).toEqual(defaults.learningStyles);
  });

  it("leaves class standing unset by default, since it is opt-in", () => {
    expect(normalizePreferences({}).classStanding).toBeNull();
    expect(defaults.classStanding).toBeNull();
  });

  it("rejects a class standing outside PolyRatings' vocabulary", () => {
    expect(normalizePreferences({ classStanding: "Fresher" }).classStanding).toBeNull();
    expect(normalizePreferences({ classStanding: "" }).classStanding).toBeNull();
    expect(normalizePreferences({ classStanding: 3 }).classStanding).toBeNull();
  });

  it("accepts every standing PolyRatings actually uses", () => {
    for (const standing of ["Freshman", "Sophomore", "Junior", "Senior", "5th/6th Year", "Grad Student"]) {
      expect(normalizePreferences({ classStanding: standing }).classStanding).toBe(standing);
    }
  });

  it("never restores a class standing the student cleared", () => {
    expect(normalizePreferences({ classStanding: null }).classStanding).toBeNull();
  });

  it("upgrades a legacy record that predates class standing", () => {
    const result = normalizePreferences({ version: 1, departments: ["CSC"], learningStyles: ["labs"] });

    expect(result.version).toBe(2);
    expect(result.classStanding).toBeNull();
    expect(result.learningStyles).toEqual(["labs"]);
  });
});
