import crosswalk from "./course-crosswalk.json";

interface Crosswalk {
  map: Record<string, string[]>;
  titles: Record<string, string>;
}

const data = crosswalk as Crosswalk;

let semesterToQuarter: Map<string, string[]> | null = null;

function reverseIndex(): Map<string, string[]> {
  if (semesterToQuarter) return semesterToQuarter;
  const index = new Map<string, string[]>();
  for (const [quarterCode, semesterCodes] of Object.entries(data.map)) {
    for (const semesterCode of semesterCodes) {
      const existing = index.get(semesterCode);
      if (existing) existing.push(quarterCode);
      else index.set(semesterCode, [quarterCode]);
    }
  }
  semesterToQuarter = index;
  return index;
}

const courseCodePattern = /\b([A-Za-z]{2,5})\s*-?\s*(\d{3,4})([A-Za-z]?)\b/g;

/** Accepts "CSC3449", "csc-3449", and "CSC 3449" and returns "CSC 3449". */
export function normalizeCourseCode(raw: string): string | null {
  return findCourseCodes(raw)[0] ?? null;
}

/** Every course-code-shaped token in `text`, in order of appearance. */
export function findCourseCodes(text: string): string[] {
  return [...text.matchAll(courseCodePattern)].map(
    (match) => `${match[1].toUpperCase()} ${match[2]}${match[3].toUpperCase()}`,
  );
}

/**
 * Every course code that refers to the same course as `code`, so a semester
 * course on screen can find reviews filed under its quarter number. Resolves in
 * both directions because a schedule for a past term can still show a quarter
 * code. A quarter course that was split returns several semester codes.
 */
export function courseAliases(code: string): string[] {
  const aliases = new Set<string>([code]);
  for (const quarterCode of reverseIndex().get(code) ?? []) aliases.add(quarterCode);
  for (const semesterCode of data.map[code] ?? []) aliases.add(semesterCode);
  return [...aliases];
}

/** Catalog title for a semester course code, when the catalog lists one. */
export function courseTitle(code: string): string | undefined {
  return data.titles[code];
}

export function isKnownCourseCode(code: string): boolean {
  return code in data.titles || code in data.map || reverseIndex().has(code);
}
