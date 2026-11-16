import { useRef, useState } from "react";
import {
  classTimeOptions,
  departmentOptions,
  quickPreferenceKeys,
  traitDefinitions,
  traitLabel,
  traitWeights,
  type ClassTime,
  type DepartmentCode,
  type StudentPreferences,
  type TraitKey,
} from "../models/preferences";
import { savePreferences } from "../services/preference-storage";
import { MatchingBanner } from "./MatchingBanner";
import { MultiSelect } from "./MultiSelect";

interface PreferencesScreenProps {
  preferences: StudentPreferences;
  onChange: (preferences: StudentPreferences) => void;
}

export function PreferencesScreen({ preferences, onChange }: PreferencesScreenProps) {
  const [status, setStatus] = useState<string | null>(null);
  const learningStyleRef = useRef<HTMLDetailsElement>(null);

  function update(partial: Partial<StudentPreferences>) {
    onChange({ ...preferences, ...partial });
    setStatus(null);
  }

  const weights = traitWeights(preferences.learningStyles);

  /** Swaps with the neighbour; React keys the rows by trait so focus follows the button. */
  function moveStyle(index: number, delta: number) {
    const next = [...preferences.learningStyles];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    update({ learningStyles: next });
  }

  function toggleQuickPreference(key: TraitKey) {
    update({
      learningStyles: preferences.learningStyles.includes(key)
        ? preferences.learningStyles.filter((item) => item !== key)
        : [...preferences.learningStyles, key],
    });
  }

  async function handleSave() {
    try {
      await savePreferences(preferences);
      setStatus("Preferences saved on this browser.");
    } catch {
      setStatus("Preferences could not be saved. Please try again.");
    }
  }

  function revealLearningStyles() {
    if (!learningStyleRef.current) return;
    learningStyleRef.current.open = true;
    learningStyleRef.current.scrollIntoView({ block: "center" });
  }

  return (
    <div className="screen">
      <MatchingBanner
        summary="Class time, learning style, department, and professor vibe"
        onEdit={revealLearningStyles}
      />

      <div className="scroll-area">
        <h1 className="prefs-title">Class &amp; Professor Preferences</h1>
        <p className="prefs-intro">
          Tell us when you prefer to take classes, how you learn best, and the department and professor vibe that fits
          you. We'll use these preferences to personalize your future search results.
        </p>

        <MultiSelect<DepartmentCode>
          label="Department"
          placeholder="Any department"
          options={departmentOptions.map((code) => ({ value: code, label: code }))}
          selected={preferences.departments}
          onChange={(departments) => update({ departments })}
        />

        <MultiSelect<ClassTime>
          label="Class time"
          placeholder="Any time"
          options={classTimeOptions}
          selected={preferences.classTimes}
          onChange={(classTimes) => update({ classTimes })}
        />

        <MultiSelect<TraitKey>
          ref={learningStyleRef}
          label="Learning style"
          placeholder="No preference set"
          options={traitDefinitions.map((trait) => ({ value: trait.key, label: trait.label }))}
          selected={preferences.learningStyles}
          onChange={(learningStyles) => update({ learningStyles })}
        />

        {preferences.learningStyles.length > 1 ? (
          <div className="field">
            <p className="section-label" id="priority-label">Preference priority</p>
            <p className="prefs-hint">
              Ranked most important first. Your top preference counts most when professors are ranked.
            </p>
            <ol className="rank-list" aria-labelledby="priority-label">
              {preferences.learningStyles.map((key, index) => (
                <li className="rank-item" key={key}>
                  <span className="rank-number" aria-hidden="true">{index + 1}</span>
                  <span className="rank-label">{traitLabel(key)}</span>
                  <span className="rank-weight">{Math.round(100 * (weights.get(key) ?? 0))}%</span>
                  <span className="rank-controls">
                    <button
                      className="rank-button"
                      type="button"
                      disabled={index === 0}
                      onClick={() => moveStyle(index, -1)}
                      aria-label={`Move ${traitLabel(key)} up to priority ${index}`}
                    >
                      ↑
                    </button>
                    <button
                      className="rank-button"
                      type="button"
                      disabled={index === preferences.learningStyles.length - 1}
                      onClick={() => moveStyle(index, 1)}
                      aria-label={`Move ${traitLabel(key)} down to priority ${index + 2}`}
                    >
                      ↓
                    </button>
                  </span>
                </li>
              ))}
            </ol>
          </div>
        ) : null}

        <div className="field">
          <p className="section-label">Quick preferences</p>
          <div className="chip-row">
            {quickPreferenceKeys.map((key) => (
              <button
                className="toggle-chip"
                type="button"
                key={key}
                aria-pressed={preferences.learningStyles.includes(key)}
                onClick={() => toggleQuickPreference(key)}
              >
                {traitLabel(key)}
              </button>
            ))}
          </div>
        </div>

        <button className="button-save" type="button" onClick={() => void handleSave()}>
          Save preferences
        </button>
        {status ? <p className="save-status" aria-live="polite">{status}</p> : null}
        <p className="prefs-footnote">You can update these anytime from Settings.</p>
      </div>
    </div>
  );
}
