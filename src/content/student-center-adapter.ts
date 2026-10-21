import { findCourseCodes, isKnownCourseCode, normalizeCourseCode } from "../data/course-crosswalk";

export interface InstructorCandidate {
  element: HTMLElement;
  sectionElement: HTMLElement | null;
  instructorName: string;
  displayName: string;
  courseCode: string | null;
  source?: InstructorDetectionSource;
}

export type InstructorDetectionSource = "my-schedule-main-row" | "my-schedule-expanded-detail" | "schedule-builder";

export interface InstructorDetectionResult {
  instructorFieldCount: number;
  candidates: InstructorCandidate[];
  myScheduleMainRowTargets: number;
  myScheduleExpandedDetailTargets: number;
  scheduleBuilderTargets: number;
}

function extractInstructorText(element: HTMLElement): string {
  let text = "";
  const visit = (node: Node) => {
    if (node.nodeType === Node.ELEMENT_NODE && (node as HTMLElement).matches("button[data-polyratings-owned-button]")) return;
    if (node.nodeType === Node.TEXT_NODE) text += node.textContent ?? "";
    if (node.nodeType === Node.ELEMENT_NODE && (node as HTMLElement).tagName === "BR") text += " ";
    node.childNodes.forEach(visit);
  };
  visit(element);
  return text;
}

function findSectionContainer(element: HTMLElement): HTMLElement | null {
  const sectionList = element.closest<HTMLElement>("[role='group'][aria-label='Section List'], [aria-label='Class Schedule']");
  const listItem = element.closest<HTMLElement>("li");
  if (sectionList && listItem && sectionList.contains(listItem)) return listItem;
  // A tabular schedule puts one class per row, which is the smallest scope that
  // still holds both the instructor cell and the course cell.
  const row = element.closest<HTMLElement>("tr, [role='row']");
  if (sectionList && row && sectionList.contains(row)) return row;
  // My Schedule uses definition lists within course cards rather than section
  // list items. The nearest list gives us the smallest semantic course scope.
  if (sectionList?.matches("[aria-label='Class Schedule']")) return element.closest<HTMLElement>("dl");
  return element.closest<HTMLElement>("[data-polyratings-course-row]");
}

const courseLabels = new Set(["course", "class", "subject", "catalog nbr", "catalog number", "course id"]);

function isCourseLabel(label: HTMLElement): boolean {
  return courseLabels.has(normalizedText(label).replace(/:$/, ""));
}

/**
 * Finds the course a section belongs to. Explicit and semantic sources are
 * trusted as-is; a loose scan of the section's text is only accepted when the
 * result is a course the catalog actually lists, so row numbers, room numbers,
 * and unit counts cannot be mistaken for a course code.
 */
export function findCourseCode(section: HTMLElement): string | null {
  const marked = section.querySelector<HTMLElement>("[data-polyratings-course-code]");
  if (marked?.textContent) return normalizeCourseCode(marked.textContent);

  for (const label of section.querySelectorAll<HTMLElement>("dt")) {
    if (!isCourseLabel(label)) continue;
    const value = findAssociatedValue(label);
    const code = value && normalizeCourseCode(extractInstructorText(value));
    if (code) return code;
  }

  const headings = section.querySelectorAll<HTMLElement>("h1, h2, h3, h4, h5, h6, [role='heading'], summary, legend, caption");
  for (const heading of headings) {
    const code = normalizeCourseCode(extractInstructorText(heading));
    if (code) return code;
  }

  for (const labelled of [section, ...section.querySelectorAll<HTMLElement>("[aria-label]")]) {
    const label = labelled.getAttribute("aria-label") ?? "";
    // Skip the label this extension writes onto a bound row, so a rescan does
    // not read back its own output.
    if (label.includes("PolyProf")) continue;
    const code = normalizeCourseCode(label);
    if (code) return code;
  }

  return findCourseCodes(spacedText(section)).find(isKnownCourseCode) ?? null;
}

/**
 * Joins text nodes with a space. Adjacent table cells carry no whitespace
 * between them in the source markup, so a plain concatenation would read
 * "CSC 4880Kurfess,Franz J" and hide the course code.
 */
function spacedText(element: HTMLElement): string {
  const parts: string[] = [];
  const walker = element.ownerDocument.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) parts.push(walker.currentNode.textContent ?? "");
  return parts.join(" ").replace(/\s+/g, " ").trim();
}

export function createInstructorCandidate(element: HTMLElement, instructorName?: string, source?: InstructorDetectionSource): InstructorCandidate {
  const sectionElement = findSectionContainer(element);
  const displayName = extractInstructorText(element);
  const normalizedAttributeName = element.getAttribute("data-name")?.trim();
  return {
    element,
    sectionElement,
    // data-name is the observed, normalized PeopleSoft value; text is a safe fallback.
    instructorName: instructorName || normalizedAttributeName || displayName,
    displayName: instructorName || displayName || normalizedAttributeName || "Instructor",
    courseCode: sectionElement ? findCourseCode(sectionElement) : null,
    source,
  };
}

function normalizedText(element: HTMLElement): string {
  return extractInstructorText(element).replace(/\s+/g, " ").trim().toLocaleLowerCase();
}

function isInstructorLabel(label: HTMLElement): boolean {
  return normalizedText(label).replace(/:$/, "") === "instructor";
}

function findAssociatedValue(label: HTMLElement): HTMLElement | null {
  const directValue = label.nextElementSibling;
  if (directValue instanceof HTMLElement && directValue.tagName === "DD") return directValue;
  const definitionList = label.closest("dl");
  if (!definitionList) return null;
  const fields = Array.from(definitionList.querySelectorAll<HTMLElement>("dt, dd"));
  const labelIndex = fields.indexOf(label);
  for (const field of fields.slice(labelIndex + 1)) {
    if (field.tagName === "DT") break;
    if (field.tagName === "DD") return field;
  }
  return null;
}

function namesFromInstructorValue(value: HTMLElement): string[] {
  const namedChildren = Array.from(value.querySelectorAll<HTMLElement>("[data-name]"));
  if (namedChildren.length > 0) return namedChildren.map((child) => child.getAttribute("data-name")?.trim() || extractInstructorText(child));
  const visibleNameLeaves = Array.from(value.querySelectorAll<HTMLElement>("span[aria-hidden='false']"))
    .filter((span) => !span.querySelector("span[aria-hidden='false']"));
  if (visibleNameLeaves.length > 1) return visibleNameLeaves.map(extractInstructorText).filter(Boolean);
  // A semicolon is an explicit name separator; do not split commas or line wraps,
  // which can be part of a single displayed name.
  return extractInstructorText(value).split(";").map((name) => name.trim()).filter(Boolean);
}

function findInstructorFieldCandidates(root: ParentNode): { candidates: InstructorCandidate[]; fieldCount: number } {
  const candidates: InstructorCandidate[] = [];
  let fieldCount = 0;
  for (const container of root.querySelectorAll<HTMLElement>("[role='group'][aria-label='Section List'], [aria-label='Class Schedule']")) {
    const source: InstructorDetectionSource = container.matches("[aria-label='Class Schedule']")
      ? "my-schedule-expanded-detail"
      : "schedule-builder";
    const sections = container.matches("[role='group'][aria-label='Section List']")
      ? Array.from(container.querySelectorAll<HTMLElement>("li"))
      : [container];
    for (const section of sections) {
      for (const label of section.querySelectorAll<HTMLElement>("dt")) {
        if (!isInstructorLabel(label)) continue;
        fieldCount += 1;
        const value = findAssociatedValue(label);
        if (!value || value.querySelector("span.prof-name[data-name]")) continue;
        for (const name of namesFromInstructorValue(value)) candidates.push(createInstructorCandidate(value, name, source));
      }
    }
  }
  return { candidates, fieldCount };
}

function findMainRowInstructorCandidates(root: ParentNode): InstructorCandidate[] {
  const candidates: InstructorCandidate[] = [];
  const scopes = root.querySelectorAll<HTMLElement>("[aria-label='Class Schedule'], [role='group'][aria-label='Section List']");
  for (const scope of scopes) {
    const source: InstructorDetectionSource = scope.matches("[aria-label='Class Schedule']")
      ? "my-schedule-main-row"
      : "schedule-builder";
    const tables = Array.from(scope.querySelectorAll<HTMLElement>("table, [role='table'], [role='grid']"));
    for (const table of tables) {
      const headers = table.tagName === "TABLE"
        ? Array.from(table.querySelectorAll<HTMLElement>("thead th"))
        : Array.from(table.querySelectorAll<HTMLElement>("[role='columnheader']"));
      const instructorIndex = headers.findIndex(isInstructorLabel);
      if (instructorIndex < 0) continue;
      const rows = table.tagName === "TABLE"
        ? Array.from(table.querySelectorAll<HTMLElement>("tbody tr"))
        : Array.from(table.querySelectorAll<HTMLElement>("[role='row']"));
      for (const row of rows) {
        const cells = Array.from(row.children).filter((child): child is HTMLElement => child instanceof HTMLElement
          && (child.tagName === "TD" || child.matches("[role='gridcell'], [role='cell']")));
        const instructorCell = cells[instructorIndex];
        if (!instructorCell) continue;
        for (const name of namesFromInstructorValue(instructorCell)) {
          candidates.push(createInstructorCandidate(instructorCell, name, source));
        }
      }
    }
  }
  return candidates;
}

function countUniqueTargets(candidates: InstructorCandidate[], source: InstructorDetectionSource): number {
  return new Set(candidates.filter((candidate) => candidate.source === source).map((candidate) => candidate.element)).size;
}

export interface RowInstructor {
  /** Canonical value used for matching. */
  instructorName: string;
  /** Value shown to the student when no rating match exists. */
  displayName: string;
}

export interface ClassRow {
  /** The element hover is bound to: the section row when one exists. */
  element: HTMLElement;
  courseCode: string | null;
  instructors: RowInstructor[];
}

/**
 * Groups already-detected instructors by their section so hovering a class
 * surfaces every professor teaching it. Instructors outside a recognizable
 * section keep their own row rather than being dropped.
 */
export function groupCandidatesIntoRows(candidates: InstructorCandidate[]): ClassRow[] {
  const rows = new Map<HTMLElement, ClassRow>();

  for (const candidate of candidates) {
    const element = candidate.sectionElement ?? candidate.element;
    const instructor: RowInstructor = {
      instructorName: candidate.instructorName,
      displayName: candidate.displayName.replace(/\s+/g, " ").trim(),
    };
    const existing = rows.get(element);
    if (existing) {
      if (!existing.instructors.some((item) => item.instructorName === instructor.instructorName)) {
        existing.instructors.push(instructor);
      }
      existing.courseCode ??= candidate.courseCode;
      continue;
    }
    rows.set(element, { element, courseCode: candidate.courseCode, instructors: [instructor] });
  }

  return [...rows.values()];
}

export function findClassRows(root: ParentNode = document): ClassRow[] {
  return groupCandidatesIntoRows(findInstructorCandidates(root));
}

/**
 * Uses the verified PeopleSoft professor contract first. Fixture markers remain
 * supported for isolated tests without broad page-text scraping.
 */
export function findInstructorCandidates(root: ParentNode = document): InstructorCandidate[] {
  return findInstructorDetection(root).candidates;
}

export function findInstructorDetection(root: ParentNode = document): InstructorDetectionResult {
  const elements = Array.from(root.querySelectorAll<HTMLElement>("span.prof-name[data-name], [data-polyratings-instructor]"));
  const directCandidates = [...new Set(elements)].map((element) => createInstructorCandidate(element));
  const fieldDetection = findInstructorFieldCandidates(root);
  const mainRowCandidates = findMainRowInstructorCandidates(root);
  const candidates = [...directCandidates, ...fieldDetection.candidates, ...mainRowCandidates]
    .filter((candidate, index, all) => all.findIndex((other) => other.element === candidate.element && other.instructorName === candidate.instructorName) === index)
    .filter((candidate) => candidate.instructorName.trim().length > 0);
  return {
    instructorFieldCount: fieldDetection.fieldCount,
    candidates,
    myScheduleMainRowTargets: countUniqueTargets(candidates, "my-schedule-main-row"),
    myScheduleExpandedDetailTargets: countUniqueTargets(candidates, "my-schedule-expanded-detail"),
    scheduleBuilderTargets: countUniqueTargets(candidates, "schedule-builder"),
  };
}
