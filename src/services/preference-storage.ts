import { createDefaultPreferences, preferenceDefinitions, type StudentPreferences } from "../models/preferences";

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

/** Safely restores missing or legacy stored fields to current defaults. */
export function normalizePreferences(value: unknown): StudentPreferences {
  const defaults = createDefaultPreferences();
  if (!value || typeof value !== "object") return defaults;
  const storedCharacteristics = (value as Partial<StudentPreferences>).characteristics;
  if (!storedCharacteristics || typeof storedCharacteristics !== "object") return defaults;

  for (const definition of preferenceDefinitions) {
    const stored = storedCharacteristics[definition.key];
    if (!stored || typeof stored !== "object") continue;
    const candidate = stored as Partial<StudentPreferences["characteristics"][typeof definition.key]>;
    if (typeof candidate.importance === "string") defaults.characteristics[definition.key].importance = candidate.importance;
    if (definition.directions && typeof candidate.preferredDirection === "string") {
      const allowedDirections = definition.directions.map((direction) => direction.value);
      if (allowedDirections.includes(candidate.preferredDirection as never)) {
        defaults.characteristics[definition.key].preferredDirection = candidate.preferredDirection;
      }
    }
  }
  return defaults;
}
