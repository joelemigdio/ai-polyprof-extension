import type { Course, CourseProfessorComparison } from "../models/professor";
import { traitLabel } from "../models/preferences";

export interface CourseHoverCardProps {
  document: Document;
  course: Course;
  comparisons: CourseProfessorComparison[];
  recommendation: CourseProfessorComparison | null;
  usesMockData: boolean;
  onCompare: (event: Event) => void;
}

function element(document: Document, tag: string, className?: string, text?: string): HTMLElement {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function availability(comparison: CourseProfessorComparison, usesMockData: boolean): string {
  if (comparison.overallRating === null || comparison.reviewCount === null) return "Rating unavailable";
  const label = `${comparison.overallRating.toFixed(1)} overall • ${comparison.reviewCount} reviews`;
  return usesMockData ? `${label} • fixture data` : label;
}

function preferenceLine(comparison: CourseProfessorComparison): string {
  if (comparison.overallRating === null) return "PolyRatings data unavailable";
  if (comparison.preferenceFit === null) return "Set learning-style preferences to personalize this comparison.";
  if (comparison.matchedTraits.length > 0) {
    return `${comparison.preferenceFit}% preference fit • Matches ${comparison.matchedTraits.map(traitLabel).join(", ")}`;
  }
  return `${comparison.preferenceFit}% preference fit • No selected teaching-preference tags are available yet`;
}

function recommendationLine(
  recommendation: CourseProfessorComparison | null,
  comparisons: CourseProfessorComparison[],
): string {
  if (comparisons.length === 0) return "Select Sections for this course to compare the professors currently available.";
  if (!recommendation) return "PolyRatings has no matching rating record for the instructors currently visible.";
  if (recommendation.preferenceFit === null) {
    return `${recommendation.instructor.displayName} is highest rated among the currently visible professors at ${recommendation.overallRating?.toFixed(2)} overall.`;
  }
  return `${recommendation.instructor.displayName} is recommended at ${recommendation.preferenceFit}% preference fit and ${recommendation.overallRating?.toFixed(2)} overall. ${recommendation.fitLine ?? ""}`.trim();
}

/**
 * Reusable content-script presentation for a locally detected course. It
 * deliberately identifies instructors as currently visible, never as every
 * person offering the course during the term.
 */
export function CourseHoverCard(props: CourseHoverCardProps): HTMLElement {
  const body = element(props.document, "div", "body course-body");
  body.append(element(
    props.document,
    "p",
    "course-disclosure",
    "Professors below are from the sections currently visible in Student Center; this is not a complete term listing.",
  ));

  const professors = element(props.document, "section", "course-professors");
  professors.append(element(props.document, "h3", undefined, "Professors in visible sections"));
  if (props.comparisons.length === 0) {
    professors.append(element(props.document, "p", "unrated", "No instructor is available in the current course view."));
  } else {
    for (const comparison of props.comparisons) {
      const item = element(props.document, "article", "course-professor");
      item.append(
        element(props.document, "p", "prof-name", comparison.instructor.displayName),
        element(props.document, "p", "prof-meta", availability(comparison, props.usesMockData)),
      );
      item.append(element(props.document, "p", "course-themes", preferenceLine(comparison)));
      if (comparison.reviewThemes.length > 0) {
        item.append(element(props.document, "p", "course-themes", `Review themes: ${comparison.reviewThemes.join(", ")}`));
      }
      professors.append(item);
    }
  }
  body.append(professors);

  const recommendation = element(props.document, "section", "summary course-recommendation");
  recommendation.append(
    element(props.document, "h3", undefined, "Recommended professor"),
    element(props.document, "p", undefined, recommendationLine(props.recommendation, props.comparisons)),
  );
  body.append(recommendation);

  const compare = element(props.document, "button", "compare", "Compare Professors") as HTMLButtonElement;
  compare.type = "button";
  compare.disabled = props.comparisons.length === 0;
  compare.addEventListener("click", props.onCompare);
  body.append(compare);
  return body;
}

export interface CourseComparisonViewProps {
  document: Document;
  comparisons: CourseProfessorComparison[];
  usesMockData: boolean;
  onBack: (event: Event) => void;
}

/** Reusable no-fabrication comparison presentation for the course card. */
export function CourseProfessorComparisonView(props: CourseComparisonViewProps): HTMLElement {
  const body = element(props.document, "div", "body course-body");
  const back = element(props.document, "button", "back", "← Back to course") as HTMLButtonElement;
  back.type = "button";
  back.addEventListener("click", props.onBack);
  body.append(back);

  if (props.comparisons.length === 0) {
    body.append(element(props.document, "p", "unrated", "No professor comparison data is available for the current course view."));
    return body;
  }

  for (const comparison of props.comparisons) {
    const item = element(props.document, "article", "comparison");
    item.append(
      element(props.document, "h3", undefined, comparison.instructor.displayName),
      element(props.document, "p", "prof-meta", availability(comparison, props.usesMockData)),
    );
    item.append(element(props.document, "p", "comparison-traits", preferenceLine(comparison)));
    if (comparison.conflictingTraits.length > 0) {
      item.append(element(
        props.document,
        "p",
        "comparison-traits",
        `Potential tradeoff: ${comparison.conflictingTraits.map(traitLabel).join(", ")}`,
      ));
    }
    if (comparison.reviewThemes.length > 0) {
      item.append(element(props.document, "p", "course-themes", `Review themes: ${comparison.reviewThemes.join(", ")}`));
    }
    body.append(item);
  }
  return body;
}
