import type { Course, CourseInstructor } from "../models/professor";

export interface InstructorCandidate {
  element: HTMLElement;
  sectionElement: HTMLElement | null;
  instructorName: string;
  displayName: string;
  courseCode: string | null;
  source?: InstructorDetectionSource;
}

export type InstructorDetectionSource = "class-search" | "my-schedule-main-row" | "my-schedule-expanded-detail" | "schedule-builder";

export interface InstructorDetectionResult {
  instructorFieldCount: number;
  candidates: InstructorCandidate[];
  myScheduleMainRowTargets: number;
  myScheduleExpandedDetailTargets: number;
  scheduleBuilderTargets: number;
  classSearchTargets: number;
}

export type CourseDetectionSource = "class-search" | "my-schedule" | "schedule-builder" | "fixture";

/** A visible, semantically identified course code/title target. */
export interface CourseCandidate {
  element: HTMLElement;
  scopeElement: HTMLElement;
  course: Course;
  source: CourseDetectionSource;
}

/** A course hover target plus the instructors visible in its local section data. */
export interface CourseHoverRow {
  element: HTMLElement;
  scopeElement: HTMLElement;
  course: Course;
  instructors: CourseInstructor[];
  visibleSectionCount: number;
  source: CourseDetectionSource;
}

const scheduleBuilderContainerSelector = "[aria-label='Section List'][role='group'], [aria-label='Sections List'][role='table']";
const scheduleScopeSelector = `${scheduleBuilderContainerSelector}, [aria-label='Class Schedule']`;

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
  // My Schedule uses definition lists within course cards rather than section
  // list items. The nearest list gives us the smallest semantic course scope.
  if (sectionList?.matches("[aria-label='Class Schedule']")) return element.closest<HTMLElement>("dl");
  return element.closest<HTMLElement>("[data-polyratings-course-row]");
}

export function createInstructorCandidate(element: HTMLElement, instructorName?: string, source?: InstructorDetectionSource): InstructorCandidate {
  const sectionElement = findSectionContainer(element);
  const courseElement = sectionElement?.querySelector<HTMLElement>("[data-polyratings-course-code]");
  const displayName = extractInstructorText(element);
  const normalizedAttributeName = element.getAttribute("data-name")?.trim();
  return {
    element,
    sectionElement,
    // data-name is the observed, normalized PeopleSoft value; text is a safe fallback.
    instructorName: instructorName || normalizedAttributeName || displayName,
    displayName: instructorName || displayName || normalizedAttributeName || "Instructor",
    courseCode: courseElement?.textContent?.replace(/\s+/g, " ").trim() ?? null,
    source,
  };
}

function normalizedText(element: HTMLElement): string {
  return extractInstructorText(element).replace(/\s+/g, " ").trim().toLocaleLowerCase();
}

function normalizeCourseCode(value: string): string | null {
  const match = value.match(/\b([a-z]{2,6})\s*(\d{3,4}[a-z]?)\b/i);
  return match ? `${match[1].toUpperCase()} ${match[2].toUpperCase()}` : null;
}

function courseFromText(value: string, titleHint?: string | null): Course | null {
  const codeMatch = value.match(/\b([a-z]{2,6})\s*(\d{3,4}[a-z]?)\b/i);
  const code = normalizeCourseCode(value);
  if (!code || !codeMatch) return null;

  let title = titleHint?.replace(/\s+/g, " ").trim() || null;
  if (!title) {
    const before = value.slice(0, codeMatch.index).replace(/[|—–:-]+\s*$/, "").trim();
    const after = value.slice((codeMatch.index ?? 0) + codeMatch[0].length).replace(/^\s*[|—–:-]\s*/, "").trim();
    // Titles are accepted only when a conventional code/title separator is
    // present, not from unrelated text in a row or card.
    if (before && /[|—–:-]\s*$/.test(value.slice(0, codeMatch.index))) title = before;
    else if (after && /^\s*[|—–:-]/.test(value.slice((codeMatch.index ?? 0) + codeMatch[0].length))) title = after;
  }
  return { code, title: title || null };
}

function isCourseFieldLabel(label: HTMLElement): boolean {
  const value = normalizedText(label).replace(/:$/, "");
  return value === "course" || value === "class";
}

function isCourseTitleLabel(label: HTMLElement): boolean {
  const value = normalizedText(label).replace(/:$/, "");
  return value === "course title" || value === "title";
}

function courseSourceFor(element: HTMLElement): CourseDetectionSource {
  if (element.closest("[aria-label='Class Schedule']")) return "my-schedule";
  if (element.closest(scheduleBuilderContainerSelector)) return "schedule-builder";
  return "class-search";
}

function courseScopeFor(element: HTMLElement): HTMLElement {
  return element.closest<HTMLElement>("[role='row'][data-row-id], [data-polyratings-course-row], dl, li") ?? element;
}

function isInstructorText(value: string): boolean {
  return value.replace(/\s+/g, " ").trim().toLocaleLowerCase().replace(/:$/, "") === "instructor";
}

function isInstructorLabel(label: HTMLElement): boolean {
  return isInstructorText(normalizedText(label));
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

function visibleInstructorTarget(value: HTMLElement): HTMLElement {
  const titled = value.querySelector<HTMLElement>("span[title]");
  if (titled?.getAttribute("title")?.trim()) return titled;
  const visibleLeaves = Array.from(value.querySelectorAll<HTMLElement>("[aria-hidden='false']"))
    .filter((element) => !element.querySelector("[aria-hidden='false']"));
  return visibleLeaves[0] ?? value;
}

function structuralPath(root: HTMLElement, descendant: HTMLElement): number[] | null {
  const path: number[] = [];
  let current: HTMLElement | null = descendant;
  while (current && current !== root) {
    const parent: HTMLElement | null = current.parentElement;
    if (!parent) return null;
    const index = Array.from(parent.children).indexOf(current);
    if (index < 0) return null;
    path.unshift(index);
    current = parent;
  }
  return current === root ? path : null;
}

function elementAtStructuralPath(root: HTMLElement, path: number[]): HTMLElement | null {
  let current: HTMLElement = root;
  for (const index of path) {
    const child = current.children.item(index);
    if (!(child instanceof HTMLElement)) return null;
    current = child;
  }
  return current;
}

function cellAtHeaderPath(row: HTMLElement, path: number[]): HTMLElement | null {
  const structuralMatch = elementAtStructuralPath(row, path);
  if (!structuralMatch) return null;
  if (structuralMatch.matches("[role='cell'], [role='gridcell']")) return structuralMatch;
  return structuralMatch.querySelector<HTMLElement>("[role='cell'], [role='gridcell']");
}

function visibleClassSearchNameElements(value: HTMLElement): HTMLElement[] {
  const titled = Array.from(value.querySelectorAll<HTMLElement>("span[title]"))
    .filter((element) => element.getAttribute("title")?.trim());
  if (titled.length > 0) return titled;

  // The verified Class Search fallback is a visible nested element. This is
  // deliberately scoped to an Instructor <dd>, not every visible element on
  // the page, to avoid treating unrelated interface text as a professor.
  const visibleLeaves = Array.from(value.querySelectorAll<HTMLElement>("[aria-hidden='false']"))
    .filter((element) => !element.querySelector("[aria-hidden='false']"));
  return visibleLeaves;
}

function findClassSearchCandidates(root: ParentNode): InstructorCandidate[] {
  const candidates: InstructorCandidate[] = [];
  for (const label of root.querySelectorAll<HTMLElement>("dl dt")) {
    if (!isInstructorLabel(label)) continue;
    if (label.closest(scheduleScopeSelector)) continue;
    const value = findAssociatedValue(label);
    if (!value) continue;
    const sectionElement = label.closest<HTMLElement>("dl");
    for (const element of visibleClassSearchNameElements(value)) {
      const title = element.getAttribute("title")?.trim();
      const candidate = createInstructorCandidate(element, title || extractInstructorText(element), "class-search");
      candidates.push({ ...candidate, sectionElement });
    }
  }
  return candidates;
}

function findInstructorFieldCandidates(root: ParentNode): { candidates: InstructorCandidate[]; fieldCount: number } {
  const candidates: InstructorCandidate[] = [];
  let fieldCount = 0;
  for (const container of root.querySelectorAll<HTMLElement>(scheduleScopeSelector)) {
    const source: InstructorDetectionSource = container.matches("[aria-label='Class Schedule']")
      ? "my-schedule-expanded-detail"
      : "schedule-builder";
    const sections = container.matches("[aria-label='Section List'][role='group']")
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
  const scopes = root.querySelectorAll<HTMLElement>(scheduleScopeSelector);
  for (const scope of scopes) {
    const source: InstructorDetectionSource = scope.matches("[aria-label='Class Schedule']")
      ? "my-schedule-main-row"
      : "schedule-builder";
    const tables = [...new Set([
      ...(scope.matches("table, [role='table'], [role='grid'], [role='treegrid']") ? [scope] : []),
      ...scope.querySelectorAll<HTMLElement>("table, [role='table'], [role='grid'], [role='treegrid']"),
    ])];
    for (const table of tables) {
      // Verified My Schedule desktop contract: the outer semantic container is
      // a treegrid, its course rows have data-row-id, and each rendered value
      // identifies its column with header="Instructor". This avoids relying
      // on generated MUI classes or trying to align the nested header grids.
      if (source === "my-schedule-main-row" && table.getAttribute("role") === "treegrid") {
        const hasInstructorColumn = Array.from(table.querySelectorAll<HTMLElement>("[role='columnheader']"))
          .some(isInstructorLabel);
        if (!hasInstructorColumn) continue;
        for (const row of table.querySelectorAll<HTMLElement>("[role='row'][data-row-id]")) {
          const instructorCells = Array.from(row.querySelectorAll<HTMLElement>("[role='gridcell'][header]"))
            .filter((cell) => isInstructorText(cell.getAttribute("header") ?? ""));
          for (const instructorCell of instructorCells) {
            for (const name of namesFromInstructorValue(instructorCell)) {
              const candidate = createInstructorCandidate(visibleInstructorTarget(instructorCell), name, source);
              candidates.push({ ...candidate, sectionElement: row });
            }
          }
        }
        continue;
      }

      const allHeaders = table.tagName === "TABLE"
        ? Array.from(table.querySelectorAll<HTMLElement>("thead th"))
        : Array.from(table.querySelectorAll<HTMLElement>("[role='columnheader']"));
      const instructorHeader = allHeaders.find(isInstructorLabel);
      if (!instructorHeader) continue;
      const headerRow = instructorHeader.closest<HTMLElement>("[role='row']");
      const headers = headerRow
        ? Array.from(headerRow.querySelectorAll<HTMLElement>("[role='columnheader']"))
          .filter((header) => header.closest("[role='row']") === headerRow)
        : allHeaders;
      const instructorIndex = headers.indexOf(instructorHeader);
      if (instructorIndex < 0) continue;
      const instructorPath = headerRow ? structuralPath(headerRow, instructorHeader) : null;
      const rows = table.tagName === "TABLE"
        ? Array.from(table.querySelectorAll<HTMLElement>("tbody tr"))
        : Array.from(table.querySelectorAll<HTMLElement>("[role='row']"));
      for (const row of rows) {
        const instructorCell = table.tagName === "TABLE"
          ? Array.from(row.children).filter((child): child is HTMLElement => child instanceof HTMLElement && child.tagName === "TD")[instructorIndex]
          : instructorPath ? cellAtHeaderPath(row, instructorPath) : null;
        if (!instructorCell) continue;
        for (const name of namesFromInstructorValue(instructorCell)) {
          candidates.push(createInstructorCandidate(visibleInstructorTarget(instructorCell), name, source));
        }
      }
    }
  }
  return candidates;
}

function findClassSearchDesktopCandidates(root: ParentNode): InstructorCandidate[] {
  const candidates: InstructorCandidate[] = [];
  for (const table of root.querySelectorAll<HTMLTableElement>("table")) {
    if (table.closest(scheduleScopeSelector)) continue;
    const headers = Array.from(table.querySelectorAll<HTMLElement>("thead th[role='columnheader']"));
    const instructorHeader = headers.find((header) => isInstructorLabel(header)
      && header.id.toUpperCase().endsWith("-INSTRUCTOR"));
    if (!instructorHeader) continue;
    for (const row of table.querySelectorAll<HTMLTableRowElement>("tbody > tr[aria-level='1'], tbody > tr:not([aria-level])")) {
      // Class Search puts an expand/control cell before its data columns. The
      // header index therefore does not align with physical <td> indices.
      // The verified, semantic cell-id suffix retains the header relationship
      // without depending on Material UI classes or a positional offset.
      const instructorCell = Array.from(row.children).find((child): child is HTMLTableCellElement => child instanceof HTMLTableCellElement
        && child.id.toUpperCase().endsWith("_INSTRUCTOR"));
      if (!instructorCell) continue;
      const target = visibleInstructorTarget(instructorCell);
      const candidate = createInstructorCandidate(target, extractInstructorText(target), "class-search");
      candidates.push({ ...candidate, sectionElement: row });
    }
  }
  return candidates;
}

function definitionListTitle(definitionList: HTMLElement): string | null {
  for (const label of definitionList.querySelectorAll<HTMLElement>("dt")) {
    if (!isCourseTitleLabel(label)) continue;
    const value = findAssociatedValue(label);
    if (value) return extractInstructorText(value).replace(/\s+/g, " ").trim() || null;
  }
  return null;
}

function findDefinitionListCourseCandidates(root: ParentNode): CourseCandidate[] {
  const candidates: CourseCandidate[] = [];
  for (const label of root.querySelectorAll<HTMLElement>("dl dt")) {
    if (!isCourseFieldLabel(label)) continue;
    const value = findAssociatedValue(label);
    if (!value) continue;
    const definitionList = label.closest<HTMLElement>("dl");
    const course = courseFromText(extractInstructorText(value), definitionList ? definitionListTitle(definitionList) : null);
    if (!course) continue;
    candidates.push({
      element: value,
      scopeElement: definitionList ?? courseScopeFor(value),
      course,
      source: courseSourceFor(value),
    });
  }
  return candidates;
}

function findMyScheduleCourseCandidates(root: ParentNode): CourseCandidate[] {
  const candidates: CourseCandidate[] = [];
  for (const table of root.querySelectorAll<HTMLElement>("[aria-label='Class Schedule'][role='treegrid']")) {
    const hasClassColumn = Array.from(table.querySelectorAll<HTMLElement>("[role='columnheader']"))
      .some((header) => normalizedText(header) === "class");
    if (!hasClassColumn) continue;
    for (const row of table.querySelectorAll<HTMLElement>("[role='row'][data-row-id]")) {
      const classCell = Array.from(row.querySelectorAll<HTMLElement>("[role='gridcell'][header]"))
        .find((cell) => (cell.getAttribute("header") ?? "").replace(/\s+/g, " ").trim().toLocaleLowerCase() === "class");
      if (!classCell) continue;
      const titleCell = Array.from(row.querySelectorAll<HTMLElement>("[role='gridcell'][header]"))
        .find((cell) => ["description", "course title"].includes((cell.getAttribute("header") ?? "").replace(/\s+/g, " ").trim().toLocaleLowerCase()));
      const course = courseFromText(extractInstructorText(classCell), titleCell ? extractInstructorText(titleCell) : null);
      if (!course) continue;
      candidates.push({ element: classCell, scopeElement: row, course, source: "my-schedule" });
    }
  }
  return candidates;
}

function findMarkedCourseCandidates(root: ParentNode): CourseCandidate[] {
  const candidates: CourseCandidate[] = [];
  for (const element of root.querySelectorAll<HTMLElement>("[data-polyratings-course-code]")) {
    const titleHint = element.getAttribute("data-polyratings-course-title");
    const course = courseFromText(extractInstructorText(element), titleHint);
    if (!course) continue;
    candidates.push({
      element,
      scopeElement: courseScopeFor(element),
      course,
      source: "fixture",
    });
  }
  return candidates;
}

/**
 * Course detection is limited to semantic course fields, verified My Schedule
 * class cells, and explicit fixture markers. It deliberately does not turn
 * arbitrary headings or page text into course targets.
 */
export function findCourseCandidates(root: ParentNode = document): CourseCandidate[] {
  const candidates = [
    ...findMarkedCourseCandidates(root),
    ...findDefinitionListCourseCandidates(root),
    ...findMyScheduleCourseCandidates(root),
  ];
  return candidates.filter((candidate, index, all) => (
    all.findIndex((other) => other.element === candidate.element && other.course.code === candidate.course.code) === index
  ));
}

/**
 * Creates one hover target per visible course field and aggregates only
 * instructors in matching currently rendered course scopes. A page can expose
 * a partial result list, so the caller must present this as non-exhaustive.
 */
export function findCourseRows(root: ParentNode = document): CourseHoverRow[] {
  const courses = findCourseCandidates(root);
  const instructors = findInstructorCandidates(root);
  return courses.map((candidate) => {
    const sameCourse = courses.filter((other) => other.course.code === candidate.course.code);
    const scopes = new Set(sameCourse.map((other) => other.scopeElement));
    const courseInstructors = instructors
      .filter((instructor) => instructor.sectionElement !== null && scopes.has(instructor.sectionElement))
      .map<CourseInstructor>((instructor) => ({
        instructorName: instructor.instructorName,
        displayName: instructor.displayName.replace(/\s+/g, " ").trim(),
        source: "currently-visible-section",
      }))
      .filter((instructor, index, all) => all.findIndex((other) => other.instructorName === instructor.instructorName) === index);
    const title = candidate.course.title ?? sameCourse.find((other) => other.course.title)?.course.title ?? null;
    return {
      element: candidate.element,
      scopeElement: candidate.scopeElement,
      course: { code: candidate.course.code, title },
      instructors: courseInstructors,
      visibleSectionCount: scopes.size,
      source: candidate.source,
    };
  });
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
  /** The visible instructor value that receives hover, focus, and click events. */
  element: HTMLElement;
  /** The course/section scope used to collect co-instructors for the shared card. */
  sectionElement: HTMLElement;
  courseCode: string | null;
  instructors: RowInstructor[];
}

/**
 * Builds one hover target per visible instructor value while retaining all
 * instructors from its semantic course/section for the shared card. Binding a
 * parent row would make the card trigger outside the instructor value and can
 * be lost when PeopleSoft replaces a row during a React render.
 */
export function groupCandidatesIntoRows(candidates: InstructorCandidate[]): ClassRow[] {
  interface GroupedSection {
    courseCode: string | null;
    instructors: RowInstructor[];
    targets: HTMLElement[];
  }
  const sections = new Map<HTMLElement, GroupedSection>();

  for (const candidate of candidates) {
    const sectionElement = candidate.sectionElement ?? candidate.element;
    const instructor: RowInstructor = {
      instructorName: candidate.instructorName,
      displayName: candidate.displayName.replace(/\s+/g, " ").trim(),
    };
    const existing = sections.get(sectionElement);
    if (!existing) {
      sections.set(sectionElement, {
        courseCode: candidate.courseCode,
        instructors: [instructor],
        targets: [candidate.element],
      });
      continue;
    }
    if (!existing.instructors.some((item) => item.instructorName === instructor.instructorName)) {
      existing.instructors.push(instructor);
    }
    if (!existing.targets.includes(candidate.element)) existing.targets.push(candidate.element);
    existing.courseCode ??= candidate.courseCode;
  }

  return [...sections.entries()].flatMap(([sectionElement, section]) => section.targets.map((element) => ({
    element,
    sectionElement,
    courseCode: section.courseCode,
    instructors: section.instructors,
  })));
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
  const classSearchCandidates = findClassSearchCandidates(root);
  const classSearchDesktopCandidates = findClassSearchDesktopCandidates(root);
  const candidates = [...directCandidates, ...fieldDetection.candidates, ...mainRowCandidates, ...classSearchCandidates, ...classSearchDesktopCandidates]
    .filter((candidate, index, all) => all.findIndex((other) => other.element === candidate.element && other.instructorName === candidate.instructorName) === index)
    .filter((candidate) => candidate.instructorName.trim().length > 0);
  return {
    instructorFieldCount: fieldDetection.fieldCount,
    candidates,
    myScheduleMainRowTargets: countUniqueTargets(candidates, "my-schedule-main-row"),
    myScheduleExpandedDetailTargets: countUniqueTargets(candidates, "my-schedule-expanded-detail"),
    scheduleBuilderTargets: countUniqueTargets(candidates, "schedule-builder"),
    classSearchTargets: countUniqueTargets(candidates, "class-search"),
  };
}
