import { describe, expect, it } from "vitest";
import type { Professor } from "../models/professor";
import { createDefaultPreferences, type StudentPreferences } from "../models/preferences";
import { buildClassSummary, buildRecommendationReason, matchProfessor, rankProfessors } from "./preference-matching";

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
    traits: ["project-heavy", "clear-grading"],
    weakTraits: [],
    reviews: [],
    ...overrides,
  };
}

function preferences(overrides: Partial<StudentPreferences> = {}): StudentPreferences {
  return { ...createDefaultPreferences(), ...overrides };
}

describe("matchProfessor", () => {
  it("raises the match percent as more selected styles overlap", () => {
    const target = professor({ traits: ["project-heavy", "labs"] });
    const narrow = matchProfessor(target, preferences({ learningStyles: ["project-heavy"] }));
    const partial = matchProfessor(target, preferences({ learningStyles: ["project-heavy", "structured"] }));

    expect(narrow.matchPercent).toBeGreaterThan(partial.matchPercent!);
  });

  it("leads the fit line with the traits the student selected", () => {
    const target = professor({ traits: ["clear-grading", "project-heavy"] });

    expect(matchProfessor(target, preferences({ learningStyles: ["project-heavy"] })).fitLine)
      .toBe("Fits: Project-focused, clear grading criteria");
    expect(matchProfessor(target, preferences({ learningStyles: ["clear-grading"] })).fitLine)
      .toBe("Fits: Clear grading criteria, project-focused");
  });

  it("describes the professor even when nothing the student picked matches", () => {
    const target = professor({ traits: ["visual-slides", "responsive"] });
    const result = matchProfessor(target, preferences({ learningStyles: ["labs"] }));

    expect(result.matchedTraits).toEqual([]);
    expect(result.fitLine).toBe("Fits: Detailed visual slides, responsive to Qs");
  });

  it("flags a known weakness instead of the fit list when the student otherwise matches", () => {
    const target = professor({ traits: ["project-heavy"], weakTraits: ["light-midterms"] });
    const result = matchProfessor(target, preferences({ learningStyles: ["project-heavy"] }));

    expect(result.hasCaveat).toBe(true);
    expect(result.fitLine).toBe("Strong fit, but higher midterm weight than preferred");
  });

  it("withholds a percent until the student selects a learning style", () => {
    const result = matchProfessor(professor(), preferences({ learningStyles: [] }));

    expect(result.matchPercent).toBeNull();
    expect(result.fitLine).toContain("Preferences");
  });
});

describe("rankProfessors", () => {
  it("reorders when the student changes their learning style", () => {
    const labsFocused = professor({ id: "labs", traits: ["labs"], starRating: 3.5, clarityRating: 3.5 });
    const projectFocused = professor({ id: "projects", traits: ["project-heavy"], starRating: 3.5, clarityRating: 3.5 });
    const pool = [labsFocused, projectFocused];

    expect(rankProfessors(pool, preferences({ learningStyles: ["labs"] }))[0].id).toBe("labs");
    expect(rankProfessors(pool, preferences({ learningStyles: ["project-heavy"] }))[0].id).toBe("projects");
  });

  it("breaks ties using the similar-student rating", () => {
    const lowPeer = professor({ id: "low", clarityRating: 3 });
    const highPeer = professor({ id: "high", clarityRating: 4.9 });

    expect(rankProfessors([lowPeer, highPeer], preferences())[0].id).toBe("high");
  });
});

describe("buildRecommendationReason", () => {
  it("names the matched styles so the recommendation is explainable", () => {
    const target = professor({ traits: ["project-heavy", "labs"] });
    const reason = buildRecommendationReason(target, preferences({ learningStyles: ["project-heavy", "labs"] }));

    expect(reason).toBe("Strongest match for project-heavy and labs — your number 1 priority.");
  });

  it("names which ranked priority the match actually satisfied", () => {
    const target = professor({ traits: ["labs"] });
    const reason = buildRecommendationReason(target, preferences({ learningStyles: ["project-heavy", "labs"] }));

    expect(reason).toBe("Strongest match for labs — your number 2 priority.");
  });

  it("omits the priority clause when only one style is selected", () => {
    const target = professor({ traits: ["labs"] });
    const reason = buildRecommendationReason(target, preferences({ learningStyles: ["labs"] }));

    expect(reason).toBe("Strongest match for labs.");
  });

  it("says so when the top result matched nothing the student selected", () => {
    const target = professor({ traits: ["visual-slides"] });
    const reason = buildRecommendationReason(target, preferences({ learningStyles: ["labs"] }));

    expect(reason).toContain("no selected learning style matched");
  });
});

describe("preference importance ranking", () => {
  it("weights the top-ranked style above the bottom-ranked one", () => {
    const topOnly = professor({ traits: ["project-heavy"] });
    const bottomOnly = professor({ traits: ["labs"] });
    const ranked = preferences({ learningStyles: ["project-heavy", "structured", "labs"] });

    expect(matchProfessor(topOnly, ranked).matchPercent).toBeGreaterThan(
      matchProfessor(bottomOnly, ranked).matchPercent!,
    );
  });

  it("reorders the winner when the student reprioritizes", () => {
    const projects = professor({ id: "projects", traits: ["project-heavy"] });
    const labs = professor({ id: "labs", traits: ["labs"] });

    const projectsFirst = preferences({ learningStyles: ["project-heavy", "labs"] });
    const labsFirst = preferences({ learningStyles: ["labs", "project-heavy"] });

    expect(rankProfessors([projects, labs], projectsFirst)[0].id).toBe("projects");
    expect(rankProfessors([projects, labs], labsFirst)[0].id).toBe("labs");
  });

  it("treats a single selected style as the whole weight", () => {
    const target = professor({ traits: ["labs"] });
    const one = matchProfessor(target, preferences({ learningStyles: ["labs"] }));
    const full = matchProfessor(professor({ traits: ["labs", "project-heavy"] }), preferences({ learningStyles: ["labs", "project-heavy"] }));

    expect(one.matchPercent).toBe(full.matchPercent);
  });

  it("still reaches the same ceiling when every ranked style matches", () => {
    const target = professor({ traits: ["project-heavy", "structured", "labs"] });
    const match = matchProfessor(target, preferences({ learningStyles: ["project-heavy", "structured", "labs"] }));
    const single = matchProfessor(professor({ traits: ["labs"] }), preferences({ learningStyles: ["labs"] }));

    expect(match.matchPercent).toBe(single.matchPercent);
  });

  it("tells the student when nobody matched their top priority", () => {
    const target = professor({ traits: ["labs"] });
    const summary = buildClassSummary([target], preferences({ learningStyles: ["project-heavy", "labs"] }));

    expect(summary).toContain("top priority");
    expect(summary).toContain("project-heavy");
  });
});
