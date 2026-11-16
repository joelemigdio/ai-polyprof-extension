import type { Course, CourseInstructor } from "../models/professor";
import { findCourseCodes, isKnownCourseCode, normalizeCourseCode } from "../data/course-crosswalk";

export interface InstructorCandidate {
  element: HTMLElement;
  sectionElement: HTMLElement | null;
  instructorName: string;
  displayName: string;
  courseCode: string | null;
  source?: InstructorDetectionSource;
}

export type InstructorDetectionSource = "class-search" | "my-schedule-main-row" | "my-schedule-expanded-detail" | "schedule-builder" | "shopping-cart" | "view-wait-list" | "drop-classes";

export interface InstructorDetectionResult {
  instructorFieldCount: number;
  candidates: InstructorCandidate[];
  myScheduleMainRowTargets: number;
  myScheduleExpandedDetailTargets: number;
  scheduleBuilderTargets: number;
  classSearchTargets: number;
  shoppingCartTargets: number;
}

export type CourseDetectionSource = "class-search" | "my-schedule" | "schedule-builder" | "shopping-cart" | "fixture";

/** A visible, semantically identified course code/title target. */
export interface CourseCandidate {
  element: HTMLElement;
  scopeElement: HTMLElement;
  course: Course;
  source: CourseDetectionSource;
  /** False when the target is an existing Student Center control. */
  clickOpensCard: boolean;
}

/** A course hover target plus the instructors visible in its local section data. */
export interface CourseHoverRow {
  element: HTMLElement;
  scopeElement: HTMLElement;
  course: Course;
  instructors: CourseInstructor[];
  visibleSectionCount: number;
  source: CourseDetectionSource;
  clickOpensCard: boolean;
}

const scheduleBuilderContainerSelector = "[aria-label='Section List'][role='group'], [aria-label='Sections List'][role='table']";
const scheduleScopeSelector = `${scheduleBuilderContainerSelector}, [aria-label='Class Schedule']`;
// View Wait List has a native Sections table but its header and data rows use
// different nested MUI layouts. It needs its own semantic mapping below.
const viewWaitListTableSelector = "[aria-label='Sections'][role='table']";
const dropClassesTableSelector = "[aria-label='Classes'][role='table']";
// Shopping Cart is its own document in TargetContent. This selector is
// deliberately scoped to its verified semantic root so similarly named cells
// in other Student Center pages cannot become professor hover targets.
const shoppingCartTreegridSelector = "html#hcx-shopping-cart [aria-label='Classes'][role='table'] [aria-label='Enrollment_Classes'][role='treegrid']";

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
  const sectionList = element.closest<HTMLElement>(`${scheduleScopeSelector}, ${viewWaitListTableSelector}, ${dropClassesTableSelector}`);
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

function hasColumnHeader(element: HTMLElement, columnName: string): boolean {
  return (element.getAttribute("header") ?? "").replace(/\s+/g, " ").trim().toLocaleLowerCase() === columnName.toLocaleLowerCase();
}

function isInstructorLabel(label: HTMLElement): boolean {
  return isInstructorText(normalizedText(label));
}

interface ScheduleBuilderSectionPageContext {
  /** The native section table, not an arbitrary similarly named list. */
  table: HTMLElement;
  /** The one course heading that describes the currently rendered sections. */
  heading: HTMLElement;
  course: Course;
}

/**
 * On Schedule Builder's destination page, the course heading and section rows
 * are siblings inside a form. The individual rows contain only section data,
 * so their shared course context must be taken from that semantic heading.
 */
function findScheduleBuilderSectionPageContexts(root: ParentNode): ScheduleBuilderSectionPageContext[] {
  const contexts: ScheduleBuilderSectionPageContext[] = [];
  for (const table of root.querySelectorAll<HTMLElement>("[aria-label='Sections List'][role='table']")) {
    const hasInstructorColumn = Array.from(table.querySelectorAll<HTMLElement>("[role='columnheader']"))
      .some(isInstructorLabel);
    if (!hasInstructorColumn) continue;

    const form = table.closest<HTMLElement>("form");
    if (!form) continue;
    const heading = Array.from(form.querySelectorAll<HTMLElement>("h1, h2, [role='heading']"))
      .find((candidate) => {
        if (!(candidate.compareDocumentPosition(table) & Node.DOCUMENT_POSITION_FOLLOWING)) return false;
        return courseFromText(extractInstructorText(candidate)) !== null;
      });
    if (!heading) continue;
    const course = courseFromText(extractInstructorText(heading));
    if (!course) continue;
    contexts.push({ table, heading, course });
  }
  return contexts;
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

function visibleInstructorTargets(value: HTMLElement): HTMLElement[] {
  // Class Search uses a titled span, while the verified Shopping Cart markup
  // puts title on a nested div. This remains safe because callers have already
  // constrained value to an Instructor field/cell.
  const titled = Array.from(value.querySelectorAll<HTMLElement>("[title]"))
    .filter((element) => element.getAttribute("title")?.trim());
  if (titled.length > 0) return titled;
  const visibleLeaves = Array.from(value.querySelectorAll<HTMLElement>("[aria-hidden='false']"))
    .filter((element) => !element.querySelector("[aria-hidden='false']"));
  if (visibleLeaves.length > 0) return visibleLeaves;

  // View Wait List renders the native instructor value as a plain paragraph
  // inside the semantically identified cell. Prefer that text leaf so the
  // hover target is the professor's name, never the whole enrollment row.
  const textLeaves = Array.from(value.querySelectorAll<HTMLElement>("p, span"))
    .filter((element) => !element.querySelector("p, span") && extractInstructorText(element).trim().length > 0);
  return textLeaves.length > 0 ? textLeaves : [value];
}

function visibleInstructorTarget(value: HTMLElement): HTMLElement {
  return visibleInstructorTargets(value)[0] ?? value;
}

function visibleCourseTarget(value: HTMLElement): HTMLElement {
  const titled = Array.from(value.querySelectorAll<HTMLElement>("[title]"))
    .find((element) => element.getAttribute("title")?.trim());
  if (titled) return titled;
  const visibleLeaf = Array.from(value.querySelectorAll<HTMLElement>("[aria-hidden='false']"))
    .find((element) => !element.querySelector("[aria-hidden='false']"));
  return visibleLeaf ?? value;
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

/**
 * View Wait List keeps semantic column headers but renders each section inside
 * a differently shaped nested row. A structural header path therefore cannot
 * identify the matching cell. Its visible instructor text is still aligned
 * beneath the native Instructor header, which is stable across responsive
 * layouts and avoids generated class names or hard-coded column numbers.
 */
function findPositionallyAlignedInstructorCandidates(
  root: ParentNode,
  tableSelector: string,
  source: Extract<InstructorDetectionSource, "view-wait-list" | "drop-classes">,
  acceptsTable: (table: HTMLElement) => boolean,
): InstructorCandidate[] {
  const candidates: InstructorCandidate[] = [];
  for (const table of root.querySelectorAll<HTMLElement>(tableSelector)) {
    if (!acceptsTable(table)) continue;
    const instructorHeader = Array.from(table.querySelectorAll<HTMLElement>("[role='columnheader']")).find(isInstructorLabel);
    if (!instructorHeader) continue;
    const headerRect = instructorHeader.getBoundingClientRect();
    if (headerRect.width <= 0 && headerRect.right <= headerRect.left) continue;

    for (const row of table.querySelectorAll<HTMLElement>("[role='row']")) {
      if (row.querySelector("[role='columnheader']")) continue;
      const cells = Array.from(row.querySelectorAll<HTMLElement>("[role='cell'], [role='gridcell']"))
        .filter((cell) => cell.closest("[role='row']") === row);
      for (const cell of cells) {
        for (const target of visibleInstructorTargets(cell)) {
          const targetRect = target.getBoundingClientRect();
          if (targetRect.width <= 0 && targetRect.right <= targetRect.left) continue;
          const center = targetRect.left + targetRect.width / 2;
          if (center < headerRect.left || center > headerRect.right) continue;
          const name = target.getAttribute("title")?.trim() || extractInstructorText(target).trim();
          if (name) candidates.push(createInstructorCandidate(target, name, source));
        }
      }
    }
  }
  return candidates;
}

function findViewWaitListCandidates(root: ParentNode): InstructorCandidate[] {
  return findPositionallyAlignedInstructorCandidates(root, viewWaitListTableSelector, "view-wait-list", () => true);
}

function isDropClassesTable(table: HTMLElement): boolean {
  const url = table.ownerDocument.defaultView?.location.href.toUpperCase() ?? "";
  if (url.includes("H_DROP_CLASSES")) return true;
  // The verified page instruction is present in the native document and keeps
  // this matcher from treating Shopping Cart's separate Classes table as Drop
  // Classes when URL information is unavailable in a test or embedded frame.
  return Array.from(table.ownerDocument.querySelectorAll<HTMLElement>("h1, h2, [role='heading']"))
    .some((heading) => normalizedText(heading).includes("select classes to drop"));
}

/** Drop Classes shares View Wait List's differently nested section rows. */
function findDropClassesCandidates(root: ParentNode): InstructorCandidate[] {
  return findPositionallyAlignedInstructorCandidates(root, dropClassesTableSelector, "drop-classes", isDropClassesTable);
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

interface ClassSearchCoursePageContext {
  /** A native search-results treegrid for exactly one rendered course. */
  table: HTMLTableElement;
  /** Its sibling course heading, which contains both title and catalog code. */
  heading: HTMLElement;
  course: Course;
}

/**
 * Class Search renders a separate semantic treegrid under each course h2. The
 * heading and table are direct siblings, so this avoids confusing results with
 * filter controls or with a second course elsewhere on the page.
 */
function findClassSearchCoursePageContexts(root: ParentNode): ClassSearchCoursePageContext[] {
  const contexts: ClassSearchCoursePageContext[] = [];
  for (const table of root.querySelectorAll<HTMLTableElement>("table[role='treegrid'][aria-label]")) {
    if (table.closest(scheduleScopeSelector)) continue;
    const hasInstructorColumn = Array.from(table.querySelectorAll<HTMLElement>("thead th[role='columnheader'][id]"))
      .some((header) => header.id.toUpperCase().endsWith("-INSTRUCTOR") && isInstructorLabel(header));
    if (!hasInstructorColumn) continue;

    const parent = table.parentElement;
    if (!parent) continue;
    const heading = Array.from(parent.children)
      .find((child): child is HTMLElement => child instanceof HTMLElement && child.matches("h2"));
    if (!heading) continue;
    const course = courseFromText(extractInstructorText(heading));
    if (!course) continue;
    contexts.push({ table, heading, course });
  }
  return contexts;
}

/**
 * Detects the verified Enrollment → Shopping Cart grid only. The content
 * script runs inside TargetContent (all_frames), so this function never
 * traverses the outer authenticated document or reads enrollment controls.
 */
function findShoppingCartCandidates(root: ParentNode): InstructorCandidate[] {
  const candidates: InstructorCandidate[] = [];
  for (const treegrid of root.querySelectorAll<HTMLElement>(shoppingCartTreegridSelector)) {
    const hasInstructorHeader = Array.from(treegrid.querySelectorAll<HTMLElement>("[role='columnheader'][header]"))
      .some((header) => isInstructorText(header.getAttribute("header") ?? ""));
    if (!hasInstructorHeader) continue;

    for (const row of treegrid.querySelectorAll<HTMLElement>("[role='row'][data-row-id]")) {
      const instructorCells = Array.from(row.querySelectorAll<HTMLElement>("[role='gridcell'][header]"))
        .filter((cell) => isInstructorText(cell.getAttribute("header") ?? ""));
      for (const cell of instructorCells) {
        const targets = visibleInstructorTargets(cell);
        const names = namesFromInstructorValue(cell);
        // Prefer one actual titled/visible name target per displayed
        // instructor. The cell fallback preserves support for a semicolon
        // separated value without broadening detection outside this field.
        for (const [index, name] of names.entries()) {
          const target = targets[index] ?? targets[0] ?? cell;
          const title = target.getAttribute("title")?.trim();
          const candidate = createInstructorCandidate(target, title || name, "shopping-cart");
          // The cart row, not the container the generic search settles on, is
          // what carries the Class cell, so the code must be read from it too.
          candidates.push({ ...candidate, sectionElement: row, courseCode: findCourseCode(row) });
        }
      }
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
      clickOpensCard: true,
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
      candidates.push({ element: classCell, scopeElement: row, course, source: "my-schedule", clickOpensCard: true });
    }
  }
  return candidates;
}

function findScheduleBuilderCourseSelectionCandidates(root: ParentNode): CourseCandidate[] {
  const candidates: CourseCandidate[] = [];
  for (const table of root.querySelectorAll<HTMLElement>("[role='table']")) {
    const headers = Array.from(table.querySelectorAll<HTMLElement>("[role='columnheader']"));
    const hasCourseHeader = headers.some((header) => normalizedText(header) === "course");
    const hasCourseTitleHeader = headers.some((header) => normalizedText(header) === "course title");
    if (!hasCourseHeader || !hasCourseTitleHeader) continue;

    for (const row of table.querySelectorAll<HTMLElement>("[role='row']")) {
      // Verified Schedule Builder course-selection markup uses a rowheader
      // button for the course code. Its immediate semantic successor is the
      // Course Title cell. No generated class names or fixed grid positions
      // are used here.
      const courseButton = row.querySelector<HTMLElement>("[role='rowheader'] button");
      if (!courseButton) continue;
      const course = courseFromText(extractInstructorText(courseButton));
      if (!course) continue;
      const fields = Array.from(row.querySelectorAll<HTMLElement>("[role='cell'], [role='rowheader']"));
      const rowHeader = courseButton.closest<HTMLElement>("[role='rowheader']");
      const rowHeaderIndex = rowHeader ? fields.indexOf(rowHeader) : -1;
      const titleCell = fields.slice(rowHeaderIndex + 1).find((field) => field.getAttribute("role") === "cell");
      const title = titleCell ? extractInstructorText(titleCell).replace(/\s+/g, " ").trim() : "";
      if (title) course.title = title;
      candidates.push({
        element: courseButton,
        scopeElement: row,
        course,
        source: "schedule-builder",
        // This button belongs to Student Center. Hover/focus may show our
        // card, but an ordinary click must keep its native action untouched.
        clickOpensCard: false,
      });
    }
  }
  return candidates;
}

/**
 * The Select Sections destination does not repeat the course code in every
 * row. Its course h2 is therefore the safe, non-native target for a single
 * comparison of all instructors rendered in the semantic Sections List.
 */
function findScheduleBuilderSectionPageCourseCandidates(root: ParentNode): CourseCandidate[] {
  return findScheduleBuilderSectionPageContexts(root).map((context) => ({
    element: context.heading,
    scopeElement: context.table,
    course: context.course,
    source: "schedule-builder",
    clickOpensCard: true,
  }));
}

/** One comparison target per visible Class Search result group. */
function findClassSearchCoursePageCourseCandidates(root: ParentNode): CourseCandidate[] {
  return findClassSearchCoursePageContexts(root).map((context) => ({
    element: context.heading,
    scopeElement: context.table,
    course: context.course,
    source: "class-search",
    clickOpensCard: true,
  }));
}

/**
 * Reads only the verified Shopping Cart Class and Description cells. The
 * target is the displayed course-code value, never a checkbox, row expander,
 * enrollment action, or another Cart control.
 */
function findShoppingCartCourseCandidates(root: ParentNode): CourseCandidate[] {
  const candidates: CourseCandidate[] = [];
  for (const treegrid of root.querySelectorAll<HTMLElement>(shoppingCartTreegridSelector)) {
    const headers = Array.from(treegrid.querySelectorAll<HTMLElement>("[role='columnheader'][header]"));
    if (!headers.some((header) => hasColumnHeader(header, "Class"))
      || !headers.some((header) => hasColumnHeader(header, "Description"))) continue;

    for (const row of treegrid.querySelectorAll<HTMLElement>("[role='row'][data-row-id]")) {
      const classCell = Array.from(row.querySelectorAll<HTMLElement>("[role='rowheader'][header]"))
        .find((cell) => hasColumnHeader(cell, "Class"));
      const descriptionCell = Array.from(row.querySelectorAll<HTMLElement>("[role='gridcell'][header]"))
        .find((cell) => hasColumnHeader(cell, "Description"));
      if (!classCell || !descriptionCell) continue;

      const target = visibleCourseTarget(classCell);
      const titleTarget = visibleCourseTarget(descriptionCell);
      const course = courseFromText(
        target.getAttribute("title")?.trim() || extractInstructorText(target),
        titleTarget.getAttribute("title")?.trim() || extractInstructorText(titleTarget),
      );
      if (!course) continue;
      candidates.push({
        element: target,
        scopeElement: row,
        course,
        source: "shopping-cart",
        clickOpensCard: true,
      });
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
      clickOpensCard: true,
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
    ...findScheduleBuilderCourseSelectionCandidates(root),
    ...findScheduleBuilderSectionPageCourseCandidates(root),
    ...findClassSearchCoursePageCourseCandidates(root),
    ...findShoppingCartCourseCandidates(root),
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
    // A course-result table owns all of its section rows. Schedule Builder can
    // additionally render a course selector and its open Section List as
    // sibling components, which requires the verified course-code fallback.
    const matchingInstructors = instructors
      .filter((instructor) => {
        if (instructor.sectionElement === null) return false;
        if (scopes.has(instructor.sectionElement)) return true;
        if ([...scopes].some((scope) => scope.contains(instructor.sectionElement!))) return true;
        // Only Schedule Builder splits the selected course row from its open
        // section list. Do not use a course-code match to bridge unrelated
        // surfaces that happen to render the same course elsewhere on a page.
        return candidate.source === "schedule-builder"
          && instructor.source === "schedule-builder"
          && instructor.courseCode === candidate.course.code;
      });
    const courseInstructors = matchingInstructors
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
      visibleSectionCount: new Set([
        ...scopes,
        ...matchingInstructors.map((instructor) => instructor.sectionElement).filter((section): section is HTMLElement => section !== null),
      ]).size,
      source: candidate.source,
      clickOpensCard: candidate.clickOpensCard,
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
  /** Detection surface, used only to vary shared-card affordances safely. */
  source?: InstructorDetectionSource;
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
    targets: Array<{ element: HTMLElement; source?: InstructorDetectionSource }>;
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
        targets: [{ element: candidate.element, source: candidate.source }],
      });
      continue;
    }
    if (!existing.instructors.some((item) => item.instructorName === instructor.instructorName)) {
      existing.instructors.push(instructor);
    }
    if (!existing.targets.some((target) => target.element === candidate.element)) {
      existing.targets.push({ element: candidate.element, source: candidate.source });
    }
    existing.courseCode ??= candidate.courseCode;
  }

  return [...sections.entries()].flatMap(([sectionElement, section]) => section.targets.map(({ element, source }) => ({
    element,
    sectionElement,
    courseCode: section.courseCode,
    instructors: section.instructors,
    source,
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
  const viewWaitListCandidates = findViewWaitListCandidates(root);
  const dropClassesCandidates = findDropClassesCandidates(root);
  const classSearchCandidates = findClassSearchCandidates(root);
  const classSearchDesktopCandidates = findClassSearchDesktopCandidates(root);
  const shoppingCartCandidates = findShoppingCartCandidates(root);
  const sectionPageContexts = findScheduleBuilderSectionPageContexts(root);
  const classSearchCourseContexts = findClassSearchCoursePageContexts(root);
  const candidates = [...directCandidates, ...fieldDetection.candidates, ...mainRowCandidates, ...viewWaitListCandidates, ...dropClassesCandidates, ...classSearchCandidates, ...classSearchDesktopCandidates, ...shoppingCartCandidates]
    .map((candidate) => {
      if (candidate.courseCode || !candidate.sectionElement) return candidate;
      const context = sectionPageContexts.find(({ table }) => table.contains(candidate.sectionElement!));
      // This row is known to be in the current Schedule Builder course's
      // Sections List, so inheriting the heading's course code is precise.
      if (context) {
        return { ...candidate, courseCode: context.course.code, source: candidate.source ?? "schedule-builder" };
      }
      const classSearchContext = classSearchCourseContexts
        .find(({ table }) => table.contains(candidate.sectionElement!));
      return classSearchContext
        ? { ...candidate, courseCode: classSearchContext.course.code, source: candidate.source ?? "class-search" }
        : candidate;
    })
    .filter((candidate, index, all) => all.findIndex((other) => other.element === candidate.element && other.instructorName === candidate.instructorName) === index)
    .filter((candidate) => candidate.instructorName.trim().length > 0);
  return {
    instructorFieldCount: fieldDetection.fieldCount,
    candidates,
    myScheduleMainRowTargets: countUniqueTargets(candidates, "my-schedule-main-row"),
    myScheduleExpandedDetailTargets: countUniqueTargets(candidates, "my-schedule-expanded-detail"),
    scheduleBuilderTargets: countUniqueTargets(candidates, "schedule-builder"),
    classSearchTargets: countUniqueTargets(candidates, "class-search"),
    shoppingCartTargets: countUniqueTargets(candidates, "shopping-cart"),
  };
}
