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

export function createInstructorCandidate(element: HTMLElement): InstructorCandidate {
  const sectionElement = findSectionContainer(element);
  const courseElement = sectionElement?.querySelector<HTMLElement>("[data-polyratings-course-code]");
  const displayName = extractInstructorText(element);
  const normalizedAttributeName = element.getAttribute("data-name")?.trim();
  return {
    element,
    sectionElement,
    // data-name is the observed, normalized PeopleSoft value; text is a safe fallback.
    instructorName: normalizedAttributeName || displayName,
    displayName: displayName || normalizedAttributeName || "Instructor",
    courseCode: courseElement?.textContent?.replace(/\s+/g, " ").trim() ?? null,
  };
}

/**
 * Uses the verified PeopleSoft professor contract first. Fixture markers remain
 * supported for isolated tests without broad page-text scraping.
 */
export function findInstructorCandidates(root: ParentNode = document): InstructorCandidate[] {
  const elements = Array.from(root.querySelectorAll<HTMLElement>("span.prof-name[data-name], [data-polyratings-instructor]"));
  return [...new Set(elements)]
    .map(createInstructorCandidate)
    .filter((candidate) => candidate.instructorName.trim().length > 0);
}
