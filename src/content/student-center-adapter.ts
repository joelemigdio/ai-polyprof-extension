export interface InstructorCandidate {
  element: HTMLElement;
  instructorName: string;
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

/**
 * Deliberately conservative adapter. The data attributes are provided by the
 * local fixture; production PeopleSoft selectors must be added only after DOM
 * evidence is captured from an authorized Student Center session.
 */
export function findInstructorCandidates(root: ParentNode = document): InstructorCandidate[] {
  return Array.from(root.querySelectorAll<HTMLElement>("[data-polyratings-instructor]"))
    .map((element) => {
      const row = element.closest<HTMLElement>("[data-polyratings-course-row]");
      const courseElement = row?.querySelector<HTMLElement>("[data-polyratings-course-code]");
      return {
        element,
        instructorName: extractInstructorText(element),
        courseCode: courseElement?.textContent?.replace(/\s+/g, " ").trim() ?? null,
      };
    })
    .filter((candidate) => candidate.instructorName.trim().length > 0);
}
