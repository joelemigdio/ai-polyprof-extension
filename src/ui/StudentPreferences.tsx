import { useEffect, useState } from "react";
import {
  createDefaultPreferences,
  preferenceDefinitions,
  type PreferenceDirection,
  type PreferenceImportance,
  type PreferenceKey,
  type StudentPreferences,
} from "../models/preferences";
import { loadPreferences, resetPreferences, savePreferences } from "../services/preference-storage";

const importanceOptions: ReadonlyArray<{ value: PreferenceImportance; label: string }> = [
  { value: "not-important", label: "Not important" },
  { value: "somewhat-important", label: "Somewhat important" },
  { value: "important", label: "Important" },
  { value: "very-important", label: "Very important" },
];

interface StudentPreferencesProps { onBack: () => void; }

export function StudentPreferences({ onBack }: StudentPreferencesProps) {
  const [preferences, setPreferences] = useState<StudentPreferences>(createDefaultPreferences);
  const [isLoading, setIsLoading] = useState(true);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    void loadPreferences()
      .then(setPreferences)
      .catch(() => setStatus("Unable to load saved preferences. Default values are shown."))
      .finally(() => setIsLoading(false));
  }, []);

  function setImportance(key: PreferenceKey, importance: PreferenceImportance) {
    setPreferences((current) => ({ ...current, characteristics: { ...current.characteristics, [key]: { ...current.characteristics[key], importance } } }));
    setStatus(null);
  }

  function setDirection(key: PreferenceKey, preferredDirection: PreferenceDirection) {
    setPreferences((current) => ({ ...current, characteristics: { ...current.characteristics, [key]: { ...current.characteristics[key], preferredDirection } } }));
    setStatus(null);
  }

  async function handleSave() {
    try {
      await savePreferences(preferences);
      setStatus("Preferences saved on this browser.");
    } catch {
      setStatus("Preferences could not be saved. Please try again.");
    }
  }

  async function handleReset() {
    try {
      const defaults = await resetPreferences();
      setPreferences(defaults);
      setStatus("Preferences reset to defaults and saved.");
    } catch {
      setStatus("Preferences could not be reset. Please try again.");
    }
  }

  return (
    <section className="preferences-view" aria-label="Student professor preferences">
      <button className="back-button" type="button" onClick={onBack}>← Back to Results</button>
      <section className="details-section">
        <h2>Professor priorities</h2>
        <p className="preferences-intro">Select how much each characteristic matters. Direction choices are separate from importance and are saved only on this browser.</p>
        {isLoading ? <p className="empty-state">Loading saved preferences…</p> : (
          <div className="preference-list">
            {preferenceDefinitions.map((definition) => {
              const preference = preferences.characteristics[definition.key];
              return (
                <fieldset className="preference-row" key={definition.key}>
                  <legend>{definition.label}</legend>
                  <label>Importance
                    <select value={preference.importance} onChange={(event) => setImportance(definition.key, event.target.value as PreferenceImportance)}>
                      {importanceOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                  </label>
                  {definition.directions ? (
                    <label>Preferred direction
                      <select value={preference.preferredDirection} onChange={(event) => setDirection(definition.key, event.target.value as PreferenceDirection)}>
                        {definition.directions.map((direction) => <option key={direction.value} value={direction.value}>{direction.label}</option>)}
                      </select>
                    </label>
                  ) : null}
                </fieldset>
              );
            })}
          </div>
        )}
        <div className="preference-actions">
          <button type="button" disabled={isLoading} onClick={() => void handleSave()}>Save Preferences</button>
          <button className="secondary-button" type="button" disabled={isLoading} onClick={() => void handleReset()}>Reset to Defaults</button>
        </div>
        {status ? <p className="save-status" aria-live="polite">{status}</p> : null}
      </section>
    </section>
  );
}
