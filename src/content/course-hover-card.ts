import { formatRating, ratingScaleMax, type Course, type CourseProfessorComparison } from "../models/professor";
import { comparisonLeaders } from "../services/course-professor-comparison";

export interface CourseHoverCardProps {
  document: Document;
  course: Course;
  comparisons: CourseProfessorComparison[];
  recommendation: { name: string; headline: string; factors: string; caveat: string | null } | null;
  onCompare: (event: Event) => void;
}

function element(document: Document, tag: string, className?: string, text?: string): HTMLElement {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function availability(comparison: CourseProfessorComparison): string {
  if (comparison.overallRating === null || comparison.reviewCount === null) return "No ratings available yet";
  const reviews = `${comparison.reviewCount} ${comparison.reviewCount === 1 ? "review" : "reviews"}`;
  return `★ ${formatRating(comparison.overallRating)} • ${reviews}`;
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
        element(props.document, "p", "prof-meta", availability(comparison)),
      );
      if (comparison.tags.length > 0) {
        item.append(element(props.document, "p", "course-themes", comparison.tags.join(" • ")));
      }
      professors.append(item);
    }
  }
  body.append(professors);

  const recommendation = element(props.document, "section", "summary course-recommendation");
  recommendation.append(element(props.document, "h3", undefined, "Recommended professor"));
  if (props.recommendation) {
    recommendation.append(
      element(props.document, "p", "rec-name", props.recommendation.name),
      element(props.document, "p", undefined, props.recommendation.headline),
      element(props.document, "p", "rec-factors", props.recommendation.factors),
    );
    if (props.recommendation.caveat) {
      recommendation.append(element(props.document, "p", "note", props.recommendation.caveat));
    }
  } else {
    recommendation.append(
      element(props.document, "p", undefined, "No rated professor is available for this course view yet."),
    );
  }
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
  onBack: (event: Event) => void;
}

function metricRow(
  document: Document,
  label: string,
  value: number | null,
  isLeader: boolean,
): HTMLElement {
  const row = element(document, "div", "metric");
  row.append(element(document, "span", "metric-label", label));
  const reading = element(
    document,
    "span",
    isLeader ? "metric-value is-leader" : "metric-value",
    value === null ? "Not rated" : formatRating(value),
  );
  if (isLeader) reading.title = `Highest ${label.toLowerCase()} of the professors compared`;
  row.append(reading);
  return row;
}

/** Side-by-side comparison over the metrics PolyRatings actually measures. */
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

  const leaders = comparisonLeaders(props.comparisons);

  for (const comparison of props.comparisons) {
    const item = element(props.document, "article", "comparison");
    const head = element(props.document, "div", "comparison-head");
    head.append(element(props.document, "h3", undefined, comparison.instructor.displayName));
    if (comparison.reviewCount !== null) {
      head.append(element(
        props.document,
        "span",
        "comparison-count",
        `${comparison.reviewCount} ${comparison.reviewCount === 1 ? "review" : "reviews"}`,
      ));
    }
    item.append(head);

    if (comparison.professorId === null) {
      item.append(element(props.document, "p", "unrated", "No unambiguous PolyRatings match for this name."));
      body.append(item);
      continue;
    }

    const metrics = element(props.document, "div", "metrics");
    metrics.append(
      metricRow(props.document, "Overall", comparison.overallRating, comparison.overallRating !== null && comparison.overallRating === leaders.overallRating),
      metricRow(props.document, "Presents clearly", comparison.clarityRating, comparison.clarityRating !== null && comparison.clarityRating === leaders.clarityRating),
      metricRow(props.document, "Recognizes struggles", comparison.supportRating, comparison.supportRating !== null && comparison.supportRating === leaders.supportRating),
    );
    item.append(metrics);

    if (comparison.tags.length > 0) {
      const tags = element(props.document, "div", "tags");
      for (const tag of comparison.tags) tags.append(element(props.document, "span", "tag", tag));
      item.append(tags);
    }
    body.append(item);
  }

  body.append(element(
    props.document,
    "p",
    "note",
    `All scores are PolyRatings values out of ${ratingScaleMax}. "Recognizes struggles" is how well students felt the professor noticed when they were stuck, not how hard the course is.`,
  ));
  return body;
}
