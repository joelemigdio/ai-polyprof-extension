export type DepartmentCode = "CSC" | "CPE" | "EE" | "STAT" | "MATH";
export type ClassTime = "morning" | "afternoon" | "evening";

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
  classTimes: ClassTime[];
  learningStyles: TraitKey[];
}

export const defaultStudentPreferences: StudentPreferences = {
  version: 2,
  departments: ["CSC", "CPE"],
  classTimes: ["morning", "afternoon"],
  learningStyles: ["project-heavy", "code-evaluation", "labs"],
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
