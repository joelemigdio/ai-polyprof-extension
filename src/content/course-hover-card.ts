import type { Course, CourseProfessorComparison } from "../models/professor";

export interface CourseHoverCardProps {
  document: Document;
  course: Course;
  comparisons: CourseProfessorComparison[];
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
    element(props.document, "p", undefined, "Personalized recommendations coming soon."),
  );
  body.append(recommendation);

  const compare = element(props.document, "button", "compare", "Compare Professors") as HTMLButtonElement;
  compare.type = "button";
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
    const traits = [
      ["Workload", comparison.workload],
      ["Difficulty", comparison.difficulty],
      ["Clarity", comparison.clarity],
      ["Flexibility", comparison.flexibility],
    ].map(([label, value]) => `${label}: ${value ?? "Unavailable"}`);
    item.append(element(props.document, "p", "comparison-traits", traits.join(" • ")));
    if (comparison.reviewThemes.length > 0) {
      item.append(element(props.document, "p", "course-themes", `Review themes: ${comparison.reviewThemes.join(", ")}`));
    }
    body.append(item);
  }
  return body;
}
