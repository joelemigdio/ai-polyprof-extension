export interface InstructorCandidate {
  element: HTMLElement;
  sectionElement: HTMLElement | null;
  instructorName: string;
  displayName: string;
  courseCode: string | null;
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
  const sectionList = element.closest<HTMLElement>("[role='group'][aria-label='Section List']");
  const listItem = element.closest<HTMLElement>("li");
  if (sectionList && listItem && sectionList.contains(listItem)) return listItem;
  return element.closest<HTMLElement>("[data-polyratings-course-row]");
}

export function createInstructorCandidate(element: HTMLElement, instructorName?: string): InstructorCandidate {
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
  };
}

function normalizedText(element: HTMLElement): string {
  return extractInstructorText(element).replace(/\s+/g, " ").trim().toLocaleLowerCase();
}

function findAssociatedValue(label: HTMLElement): HTMLElement | null {
  const directValue = label.nextElementSibling;
  if (directValue instanceof HTMLElement && directValue.tagName === "DD") return directValue;
  const definitionList = label.closest("dl");
  return definitionList?.querySelector<HTMLElement>("dd") ?? null;
}

function namesFromInstructorValue(value: HTMLElement): string[] {
  const namedChildren = Array.from(value.querySelectorAll<HTMLElement>("[data-name]"));
  if (namedChildren.length > 0) return namedChildren.map((child) => child.getAttribute("data-name")?.trim() || extractInstructorText(child));
  // A semicolon is an explicit name separator; do not split commas or line wraps,
  // which can be part of a single displayed name.
  return extractInstructorText(value).split(";").map((name) => name.trim()).filter(Boolean);
}

function findInstructorFieldCandidates(root: ParentNode): InstructorCandidate[] {
  const candidates: InstructorCandidate[] = [];
  for (const sectionList of root.querySelectorAll<HTMLElement>("[role='group'][aria-label='Section List']")) {
    for (const section of sectionList.querySelectorAll<HTMLElement>("li")) {
      for (const label of section.querySelectorAll<HTMLElement>("dt")) {
        if (normalizedText(label) !== "instructor") continue;
        const value = findAssociatedValue(label);
        if (!value || value.querySelector("span.prof-name[data-name]")) continue;
        for (const name of namesFromInstructorValue(value)) candidates.push(createInstructorCandidate(value, name));
      }
    }
  }
  return candidates;
}

/**
 * Uses the verified PeopleSoft professor contract first. Fixture markers remain
 * supported for isolated tests without broad page-text scraping.
 */
export function findInstructorCandidates(root: ParentNode = document): InstructorCandidate[] {
  const elements = Array.from(root.querySelectorAll<HTMLElement>("span.prof-name[data-name], [data-polyratings-instructor]"));
  const directCandidates = [...new Set(elements)].map((element) => createInstructorCandidate(element));
  const fieldCandidates = findInstructorFieldCandidates(root);
  return [...directCandidates, ...fieldCandidates]
    .filter((candidate, index, all) => all.findIndex((other) => other.element === candidate.element && other.instructorName === candidate.instructorName) === index)
    .filter((candidate) => candidate.instructorName.trim().length > 0);
}
