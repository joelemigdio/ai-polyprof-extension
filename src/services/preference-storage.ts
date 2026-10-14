import {
  defaultStudentPreferences,
  type StudentPreferences,
} from "../models/preferences";

const storageKey = "studentPreferences";

export async function loadPreferences(): Promise<StudentPreferences> {
  const value = await chrome.storage.local.get(storageKey);
  return (value[storageKey] as StudentPreferences | undefined) ?? defaultStudentPreferences;
}

export async function savePreferences(preferences: StudentPreferences): Promise<void> {
  await chrome.storage.local.set({ [storageKey]: preferences });
}
