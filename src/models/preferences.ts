export type DepartmentCode = "CSC" | "CPE" | "EE" | "STAT" | "MATH";
export type ClassTime = "morning" | "afternoon" | "evening";

/**
 * PolyRatings' own `gradeLevel` vocabulary, used verbatim so reviews can be
 * bucketed by a string compare with no mapping layer to drift.
 */
export type ClassStanding = "Freshman" | "Sophomore" | "Junior" | "Senior" | "5th/6th Year" | "Grad Student";

/** Ordered youngest to oldest; adjacency in the cohort fallback is a step here. */
export const classStandingOptions: ReadonlyArray<ClassStanding> = [
  "Freshman",
  "Sophomore",
  "Junior",
  "Senior",
  "5th/6th Year",
  "Grad Student",
];

/**
 * Teaching characteristics. Professors are tagged with the same keys so the
 * matcher can intersect a student's selections with a professor's traits.
 */
export type TraitKey =
  | "project-heavy"
  | "code-evaluation"
  | "labs"
  | "clear-grading"
  | "structured"
  | "visual-slides"
  | "responsive"
  | "light-midterms";

export interface TraitDefinition {
  key: TraitKey;
  /** Shown on chips and in the learning-style list. */
  label: string;
  /** Shown in a professor card's "Fits:" line; capitalized when it leads. */
  fitPhrase: string;
  /** Shown when a student wants this trait but the professor is weak on it. */
  weakPhrase: string;
}

export const traitDefinitions: ReadonlyArray<TraitDefinition> = [
  { key: "project-heavy", label: "Project-heavy", fitPhrase: "project-focused", weakPhrase: "less project work" },
  { key: "code-evaluation", label: "Code evaluation", fitPhrase: "high coding weight", weakPhrase: "less coding weight" },
  { key: "labs", label: "Labs", fitPhrase: "interactive lab style", weakPhrase: "fewer interactive labs" },
  { key: "clear-grading", label: "Clear grading", fitPhrase: "clear grading criteria", weakPhrase: "less predictable grading" },
  { key: "structured", label: "Structured", fitPhrase: "structured requirements", weakPhrase: "looser structure" },
  { key: "visual-slides", label: "Detailed visual slides", fitPhrase: "detailed visual slides", weakPhrase: "sparser slides" },
  { key: "responsive", label: "Responsive to questions", fitPhrase: "responsive to Qs", weakPhrase: "slower to answer questions" },
  { key: "light-midterms", label: "Light midterm weight", fitPhrase: "lighter midterm weight", weakPhrase: "higher midterm weight" },
];

export const departmentOptions: ReadonlyArray<DepartmentCode> = ["CSC", "CPE", "EE", "STAT", "MATH"];

export const classTimeOptions: ReadonlyArray<{ value: ClassTime; label: string }> = [
  { value: "morning", label: "Morning" },
  { value: "afternoon", label: "Afternoon" },
  { value: "evening", label: "Evening" },
];

/** The five traits surfaced as one-tap chips on the preferences screen. */
export const quickPreferenceKeys: ReadonlyArray<TraitKey> = [
  "project-heavy",
  "code-evaluation",
  "labs",
  "clear-grading",
  "structured",
];

export interface StudentPreferences {
  version: 2;
  departments: DepartmentCode[];
  /**
   * Null until the student opts in. The spec asks for academic year only when
   * peer-based recommendations are wanted, so this stays unset by default and
   * recommendations fall back to the whole review corpus without it.
   */
  classStanding: ClassStanding | null;
  /** Stored for future schedule filtering; not yet used in matching. */
  classTimes: ClassTime[];
  /**
   * Ordered most important first. The position is the student's ranking, so
   * reordering this array is what changes how much each style counts.
   */
  learningStyles: TraitKey[];
}

/**
 * Converts the student's ranking into weights that sum to 1, decaying linearly
 * so the top choice outweighs the last. With three styles the split is
 * 50/33/17, which is enough for a reorder to visibly change the ranking.
 */
export function traitWeights(styles: TraitKey[]): Map<TraitKey, number> {
  const total = (styles.length * (styles.length + 1)) / 2;
  if (total === 0) return new Map();
  return new Map(styles.map((key, index) => [key, (styles.length - index) / total]));
}

/**
 * The defaults are the three traits that PolyRatings tags can actually
 * substantiate. The previous defaults (project-heavy, code-evaluation, labs)
 * have no equivalent in real data, so a fresh install matched nothing and
 * reported that every professor failed every preference.
 */
export const defaultStudentPreferences: StudentPreferences = {
  version: 2,
  departments: ["CSC", "CPE"],
  classStanding: null,
  classTimes: ["morning", "afternoon"],
  learningStyles: ["visual-slides", "responsive", "structured"],
};

export function createDefaultPreferences(): StudentPreferences {
  return structuredClone(defaultStudentPreferences);
}

export function traitLabel(key: TraitKey): string {
  return traitDefinitions.find((trait) => trait.key === key)?.label ?? key;
}

export function traitFitPhrase(key: TraitKey): string {
  return traitDefinitions.find((trait) => trait.key === key)?.fitPhrase ?? key;
}

export function traitWeakPhrase(key: TraitKey): string {
  return traitDefinitions.find((trait) => trait.key === key)?.weakPhrase ?? key;
}
