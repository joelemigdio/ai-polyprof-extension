import { forwardRef } from "react";
import { ChevronDownIcon } from "./Icons";

interface MultiSelectOption<T extends string> {
  value: T;
  label: string;
}

interface MultiSelectProps<T extends string> {
  label: string;
  options: ReadonlyArray<MultiSelectOption<T>>;
  selected: T[];
  placeholder: string;
  onChange: (selected: T[]) => void;
}

/**
 * Collapsed summary of comma-joined selections that expands to a checkbox list.
 * `details` gives keyboard and toggle behavior without tracking open state.
 */
function MultiSelectInner<T extends string>(
  { label, options, selected, placeholder, onChange }: MultiSelectProps<T>,
  ref: React.ForwardedRef<HTMLDetailsElement>,
) {
  // Follows selection order rather than option order, because for learning
  // styles that order is the student's ranking.
  const summaryText = selected.length > 0
    ? selected.map((value) => options.find((option) => option.value === value)?.label ?? value).join(", ")
    : placeholder;

  function toggle(value: T) {
    onChange(selected.includes(value) ? selected.filter((item) => item !== value) : [...selected, value]);
  }

  return (
    <div className="field">
      <p className="section-label" id={`${label}-label`}>{label}</p>
      <details className="multiselect" ref={ref}>
        <summary aria-labelledby={`${label}-label`}>
          <span className={selected.length > 0 ? "multiselect-value" : "multiselect-value is-empty"}>{summaryText}</span>
          <ChevronDownIcon size={18} />
        </summary>
        <div className="multiselect-options">
          {options.map((option) => (
            <label key={option.value}>
              <input
                type="checkbox"
                checked={selected.includes(option.value)}
                onChange={() => toggle(option.value)}
              />
              {option.label}
            </label>
          ))}
        </div>
      </details>
    </div>
  );
}

export const MultiSelect = forwardRef(MultiSelectInner) as <T extends string>(
  props: MultiSelectProps<T> & { ref?: React.ForwardedRef<HTMLDetailsElement> },
) => ReturnType<typeof MultiSelectInner>;
