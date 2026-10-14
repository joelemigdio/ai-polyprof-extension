export type PreferenceImportance =
  | "not-important"
  | "somewhat-important"
  | "important"
  | "very-important";

export type PreferenceKey =
  | "teachingQuality"
  | "workload"
  | "difficulty"
  | "attendance"
  | "grading"
  | "clarity"
  | "organization";

export type PreferenceDirection =
  | "lighter"
  | "heavier"
  | "easier"
  | "more-challenging"
  | "flexible"
  | "strict";

export interface ProfessorPreference {
  importance: PreferenceImportance;
  preferredDirection?: PreferenceDirection;
}

/** Student-owned signals kept separate from future professor/course/peer data. */
export interface StudentPreferences {
  version: 1;
  characteristics: Record<PreferenceKey, ProfessorPreference>;
}

export interface PreferenceDefinition {
  key: PreferenceKey;
  label: string;
  directions?: ReadonlyArray<{ value: PreferenceDirection; label: string }>;
}

export const preferenceDefinitions: ReadonlyArray<PreferenceDefinition> = [
  { key: "teachingQuality", label: "Teaching quality" },
  { key: "workload", label: "Workload", directions: [{ value: "lighter", label: "Lighter" }, { value: "heavier", label: "Heavier" }] },
  { key: "difficulty", label: "Difficulty", directions: [{ value: "easier", label: "Easier" }, { value: "more-challenging", label: "More challenging" }] },
  { key: "attendance", label: "Attendance flexibility", directions: [{ value: "flexible", label: "Flexible" }, { value: "strict", label: "Strict" }] },
  { key: "grading", label: "Grading flexibility", directions: [{ value: "flexible", label: "Flexible" }, { value: "strict", label: "Strict" }] },
  { key: "clarity", label: "Clarity" },
  { key: "organization", label: "Organization" },
];

export const defaultStudentPreferences: StudentPreferences = {
  version: 1,
  characteristics: {
    teachingQuality: { importance: "not-important" },
    workload: { importance: "not-important", preferredDirection: "lighter" },
    difficulty: { importance: "not-important", preferredDirection: "easier" },
    attendance: { importance: "not-important", preferredDirection: "flexible" },
    grading: { importance: "not-important", preferredDirection: "flexible" },
    clarity: { importance: "not-important" },
    organization: { importance: "not-important" },
  },
};

export function createDefaultPreferences(): StudentPreferences {
  return structuredClone(defaultStudentPreferences);
}
