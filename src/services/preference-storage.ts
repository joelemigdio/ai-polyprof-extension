import {
  classStandingOptions,
  classTimeOptions,
  createDefaultPreferences,
  departmentOptions,
  traitDefinitions,
  type ClassStanding,
  type ClassTime,
  type DepartmentCode,
  type StudentPreferences,
  type TraitKey,
} from "../models/preferences";

const storageKey = "studentPreferences";

export async function loadPreferences(): Promise<StudentPreferences> {
  const value = await chrome.storage.local.get(storageKey);
  return normalizePreferences(value[storageKey]);
}

export async function savePreferences(preferences: StudentPreferences): Promise<void> {
  await chrome.storage.local.set({ [storageKey]: preferences });
}

export async function resetPreferences(): Promise<StudentPreferences> {
  const defaults = createDefaultPreferences();
  await savePreferences(defaults);
  return defaults;
}

function keepKnown<T extends string>(value: unknown, allowed: ReadonlyArray<T>): T[] | null {
  if (!Array.isArray(value)) return null;
  return value.filter((item): item is T => typeof item === "string" && allowed.includes(item as T));
}

/** Drops unknown or legacy stored values rather than failing to load. */
export function normalizePreferences(value: unknown): StudentPreferences {
  const defaults = createDefaultPreferences();
  if (!value || typeof value !== "object") return defaults;

  const stored = value as Partial<StudentPreferences>;
  const departments = keepKnown<DepartmentCode>(stored.departments, departmentOptions);
  const classTimes = keepKnown<ClassTime>(stored.classTimes, classTimeOptions.map((option) => option.value));
  const learningStyles = keepKnown<TraitKey>(stored.learningStyles, traitDefinitions.map((trait) => trait.key));
  const classStanding = classStandingOptions.includes(stored.classStanding as ClassStanding)
    ? (stored.classStanding as ClassStanding)
    : null;

  return {
    version: 2,
    departments: departments ?? defaults.departments,
    // Absent stays absent: an unset academic year is a valid, private choice,
    // so it must never fall back to a default value.
    classStanding,
    classTimes: classTimes ?? defaults.classTimes,
    learningStyles: learningStyles ?? defaults.learningStyles,
  };
}
