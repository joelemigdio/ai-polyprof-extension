/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Professor } from "../models/professor";
import { createDefaultPreferences } from "../models/preferences";
import { findConfidentProfessor, normalizeInstructorName } from "./professor-detection";
import { findCourseCandidates, findCourseRows, findInstructorCandidates, findInstructorDetection } from "./student-center-adapter";
import { StudentCenterIntegration, type StudentCenterIntegrationOptions } from "./student-center-integration";

const professor: Professor = {
  id: "fixture-ada",
  name: "Ada Lovelace",
  firstName: "Ada",
  lastName: "Lovelace",
  department: "CSC",
  courses: ["CSC 4880"],
  starRating: 3.6,
  clarityRating: 3.4,
  supportRating: 3.2,
  reviewCount: 2,
  tags: ["Uploads Slides"],
  traits: ["project-heavy", "clear-grading"],
  weakTraits: [],
  reviews: [
    {
      id: "review-1",
      courseCode: "CSC 4880",
      classYear: "Senior",
      rating: 4,
      text: "Clear lectures.",
      grade: "A",
      courseType: "Major (Required)",
      postDate: "2026-02-01T00:00:00.000Z",
    },
  ],
};

function setFixture(markup: string): StudentCenterIntegration {
  document.documentElement.setAttribute("data-polyratings-fixture", "");
  document.body.innerHTML = markup;
  const integration = new StudentCenterIntegration({ document, professors: [professor] });
  integration.start();
  return integration;
}

function rect(left: number, top: number, width: number, height: number): DOMRect {
  return {
    x: left,
    y: top,
    width,
    height,
    top,
    right: left + width,
    bottom: top + height,
    left,
    toJSON: () => ({}),
  } as DOMRect;
}

function setViewport(width: number, height: number): () => void {
  const originalWidth = Object.getOwnPropertyDescriptor(window, "innerWidth");
  const originalHeight = Object.getOwnPropertyDescriptor(window, "innerHeight");
  Object.defineProperty(window, "innerWidth", { configurable: true, value: width });
  Object.defineProperty(window, "innerHeight", { configurable: true, value: height });
  return () => {
    if (originalWidth) Object.defineProperty(window, "innerWidth", originalWidth);
    if (originalHeight) Object.defineProperty(window, "innerHeight", originalHeight);
  };
}

function mockTargetAndCardRects(target: HTMLElement, getTargetRect: () => DOMRect, getCardRect: () => DOMRect) {
  return vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function(this: HTMLElement) {
    if (this === target) return getTargetRect();
    if (this.classList.contains("card")) return getCardRect();
    return rect(0, 0, 0, 0);
  });
}

afterEach(() => {
  document.documentElement.removeAttribute("data-polyratings-fixture");
  document.documentElement.removeAttribute("id");
  document.querySelector("#polyratings-hover-host")?.remove();
  vi.useRealTimers();
});

describe("professor detection", () => {
  it("normalizes casing and wrapped whitespace without altering name order", () => {
    expect(normalizeInstructorName("  DR. Ada\n Lovelace ")).toBe("dr. ada lovelace");
    expect(normalizeInstructorName("Ana María O'Connor-Smith")).toBe("ana maría o'connor-smith");
  });

  it("refuses ambiguous duplicate-name matches", () => {
    expect(findConfidentProfessor("Dr. Ada Lovelace", [professor, { ...professor, id: "duplicate" }])).toBeNull();
  });
});

describe("course number detection", () => {
  function courseCodeFor(markup: string): string | null {
    document.body.innerHTML = markup;
    return findInstructorCandidates(document)[0]?.courseCode ?? null;
  }

  it("reads a Course field paired with its value", () => {
    expect(
      courseCodeFor(
        `<div aria-label="Section List" role="group"><ul><li><dl><dt>Course</dt><dd>CSC 3449</dd><dt>Instructor</dt><dd>Kurfess,Franz J</dd></dl></li></ul></div>`,
      ),
    ).toBe("CSC 3449");
  });

  it("reads a heading above the section", () => {
    expect(
      courseCodeFor(
        `<div aria-label="Section List" role="group"><ul><li><h3>CSC 2050 - System Software Mechanics</h3><dl><dt>Instructor</dt><dd>Kurfess,Franz J</dd></dl></li></ul></div>`,
      ),
    ).toBe("CSC 2050");
  });

  it("falls back to a catalog-verified code elsewhere in the row", () => {
    expect(
      courseCodeFor(
        `<div aria-label="Class Schedule"><table><thead><tr><th>Class</th><th>Instructor</th></tr></thead><tbody><tr><td>CSC 4880</td><td>Kurfess,Franz J</td></tr></tbody></table></div>`,
      ),
    ).toBe("CSC 4880");
  });

  it("does not mistake times, rooms, or terms for a course code", () => {
    expect(
      courseCodeFor(
        `<div aria-label="Section List" role="group"><ul><li>Section 01 MWF 9:00 Room 1420 FALL 2026<dl><dt>Instructor</dt><dd>Kurfess,Franz J</dd></dl></li></ul></div>`,
      ),
    ).toBeNull();
  });
});

describe("Student Center integration fixture", () => {
  it("detects observed prof-name data attributes and associates the nearest semantic section", () => {
    document.body.innerHTML = `<div aria-label="Section List" role="group"><li><span class="prof-name" data-name="DR. Ada Lovelace">Displayed Name</span><span class="prof-name" data-name="Dr. Grace Hopper">Grace</span></li></div>`;
    const candidates = findInstructorCandidates(document);
    expect(candidates.map((candidate) => candidate.instructorName)).toEqual(["DR. Ada Lovelace", "Dr. Grace Hopper"]);
    expect(candidates[0].sectionElement?.tagName).toBe("LI");
  });

  it("detects only dd values paired with an Instructor dt, including explicit multiple instructors", () => {
    document.body.innerHTML = `<div aria-label="Section List" role="group"><ul><li><dl><dt>Units</dt><dd>4</dd><dt> Instructor </dt><dd>Dr. Ada Lovelace; Dr. Grace Hopper</dd></dl></li></ul></div>`;
    const candidates = findInstructorCandidates(document);
    expect(candidates.map((candidate) => candidate.instructorName)).toEqual(["Dr. Ada Lovelace", "Dr. Grace Hopper"]);
    expect(candidates.every((candidate) => candidate.sectionElement?.tagName === "LI")).toBe(true);
  });

  it("detects My Schedule instructor values nested inside dd div span structures", () => {
    document.body.innerHTML = `<div aria-label="Class Schedule"><article><dl><dt>Course</dt><dd>CSC 4880</dd><dt>Instructor:</dt><dd><div><span aria-hidden="false">Dr. Ada Lovelace</span></div></dd></dl></article></div><span aria-hidden="false">Unrelated page text</span>`;
    const detection = findInstructorDetection(document);
    expect(detection.instructorFieldCount).toBe(1);
    expect(detection.candidates.map((candidate) => candidate.instructorName)).toEqual(["Dr. Ada Lovelace"]);
    expect(detection.candidates[0].sectionElement?.tagName).toBe("DL");
  });

  it("supports responsive My Schedule definition-list wrappers, repeated instructors, and multiple visible name values", () => {
    document.body.innerHTML = `<div aria-label="Class Schedule"><section><dl><div><dt>Instructor</dt><dd><div><span aria-hidden="false">Dr. Ada Lovelace</span><span aria-hidden="false">Dr. Grace Hopper</span></div></dd></div></dl><dl><dt>Instructor</dt><dd><div><span aria-hidden="false">Dr. Ada Lovelace</span></div></dd></dl></section></div>`;
    const detection = findInstructorDetection(document);
    expect(detection.instructorFieldCount).toBe(2);
    expect(detection.candidates.map((candidate) => candidate.instructorName)).toEqual([
      "Dr. Ada Lovelace",
      "Dr. Grace Hopper",
      "Dr. Ada Lovelace",
    ]);
  });

  it("detects Class Search title values only inside an Instructor definition-list field", () => {
    document.body.innerHTML = `<main><article><dl><dt>Subject</dt><dd>Computer Science</dd><dt>Instructor</dt><dd><div><span title="Dr. Ada Lovelace"><div aria-hidden="false">Dr. Ada Lovelace</div></span><span title="Dr. Grace Hopper"><div aria-hidden="false">Dr. Grace Hopper</div></span></div></dd></dl></article><span title="Unrelated control">Unrelated control</span></main>`;
    const detection = findInstructorDetection(document);
    expect(detection.classSearchTargets).toBe(2);
    expect(detection.candidates.map((candidate) => candidate.instructorName)).toEqual(["Dr. Ada Lovelace", "Dr. Grace Hopper"]);
    expect(detection.candidates.every((candidate) => candidate.element.matches("span[title]"))).toBe(true);
  });

  it("uses a visible nested Class Search value when an instructor span has no title", () => {
    document.body.innerHTML = `<article><dl><dt>Instructor:</dt><dd><div><span><div aria-hidden="false">Dr. Ada Lovelace</div></span></div></dd></dl></article>`;
    const detection = findInstructorDetection(document);
    expect(detection.classSearchTargets).toBe(1);
    expect(detection.candidates[0].instructorName).toBe("Dr. Ada Lovelace");
    expect(detection.candidates[0].element.getAttribute("aria-hidden")).toBe("false");
  });

  it("detects the verified desktop Class Search instructor column and targets its visible nested name", () => {
    document.body.innerHTML = `<table><thead><tr><th role="columnheader" id="grid-CLASS_SECTION">section</th><th role="columnheader" id="grid-TOPIC">topic</th><th role="columnheader" id="grid-INSTRUCTOR"><button type="button"><p>instructor</p></button></th><th role="columnheader" id="grid-DATES">dates</th></tr></thead><tbody><tr data-row-id="0" aria-level="1"><td role="gridcell" aria-hidden="true">expand</td><td role="rowheader">S01</td><td role="gridcell">Lecture</td><td role="gridcell">Dairy Unit 018</td><td role="gridcell" id="grid-0_INSTRUCTOR"><div><span><div aria-hidden="false">Dr. Ada Lovelace</div></span></div></td><td role="gridcell">Fall</td></tr><tr data-row-id="1" aria-level="1"><td role="gridcell" aria-hidden="true">expand</td><td role="rowheader">S02</td><td role="gridcell">Lab</td><td role="gridcell">Dairy Unit 018</td><td role="gridcell" id="grid-1_INSTRUCTOR"><div><span><div aria-hidden="false">Dr. Ada Lovelace</div></span></div></td><td role="gridcell">Fall</td></tr><tr data-row-id="0-details" aria-level="2"><td colspan="4">detail row</td></tr></tbody></table>`;
    const detection = findInstructorDetection(document);
    expect(detection.classSearchTargets).toBe(2);
    expect(detection.candidates.map((candidate) => candidate.instructorName)).toEqual(["Dr. Ada Lovelace", "Dr. Ada Lovelace"]);
    expect(detection.candidates.every((candidate) => candidate.element.getAttribute("aria-hidden") === "false")).toBe(true);
  });

  it("detects View Wait List's differently nested native rows by their Instructor column position", () => {
    document.body.innerHTML = `<main><h1>View Wait List</h1><div aria-label="Sections" role="table"><div role="row"><div role="columnheader">Section</div><div role="columnheader"><p>Instructor</p></div><div role="columnheader">List Position</div></div><div role="row"><div role="cell">DATA 4610 S03-LEC (2881)</div><div role="cell"><div><p data-wait-list-instructor>Austin Wright</p></div></div><div role="cell">4</div></div><div role="row"><div role="cell">DATA 4610 S04-LAB (2882)</div><div role="cell"><div><p data-wait-list-instructor>Austin Wright</p></div></div><div role="cell">4</div></div></div></main>`;
    const originalRect = HTMLElement.prototype.getBoundingClientRect;
    const rectForWaitList = function(this: HTMLElement): DOMRect {
      if (this.matches("[role='columnheader']") && this.textContent?.includes("Instructor")) return rect(600, 0, 160, 30);
      if (this.hasAttribute("data-wait-list-instructor")) return rect(620, 80, 100, 20);
      return rect(0, 0, 0, 0);
    };
    HTMLElement.prototype.getBoundingClientRect = rectForWaitList;

    try {
      const detection = findInstructorDetection(document);
      expect(detection.candidates.map((candidate) => candidate.instructorName)).toEqual(["Austin Wright", "Austin Wright"]);
      expect(detection.candidates.every((candidate) => candidate.source === "view-wait-list")).toBe(true);
      expect(detection.candidates.every((candidate) => candidate.element.tagName === "P")).toBe(true);
      expect(detection.candidates.every((candidate) => candidate.sectionElement?.getAttribute("role") === "row")).toBe(true);
    } finally {
      HTMLElement.prototype.getBoundingClientRect = originalRect;
    }
  });

  it("detects the native Drop Classes Instructor column without binding its selection checkbox", () => {
    document.body.innerHTML = `<main><h1>Drop Classes</h1><h2>Select classes to drop and then select Drop</h2><button id="drop" type="button">Drop</button><div aria-label="Classes" role="table"><div role="row"><div role="columnheader">Class</div><div role="columnheader"><p>Instructor</p></div><div role="columnheader">Status</div></div><div role="row"><div role="cell"><p>CSC 3780 S01-LEC (6155)</p></div><div role="cell"><div><p data-drop-classes-instructor>April Grow</p></div></div><div role="cell">Open</div><input id="drop-checkbox" type="checkbox" aria-label="CSC 3780" /></div><div role="row"><div role="cell"><p>DATA 4610 S03-LEC (2881)</p></div><div role="cell"><div><p data-drop-classes-instructor>Austin Wright</p></div></div><div role="cell">Waitlisted</div></div></div></main>`;
    const originalRect = HTMLElement.prototype.getBoundingClientRect;
    const rectForDropClasses = function(this: HTMLElement): DOMRect {
      if (this.matches("[role='columnheader']") && this.textContent?.includes("Instructor")) return rect(600, 0, 160, 30);
      if (this.hasAttribute("data-drop-classes-instructor")) return rect(620, 80, 100, 20);
      return rect(0, 0, 0, 0);
    };
    HTMLElement.prototype.getBoundingClientRect = rectForDropClasses;

    try {
      const detection = findInstructorDetection(document);
      expect(detection.candidates.map((candidate) => candidate.instructorName)).toEqual(["April Grow", "Austin Wright"]);
      expect(detection.candidates.every((candidate) => candidate.source === "drop-classes")).toBe(true);
      expect(detection.candidates.every((candidate) => candidate.element.tagName === "P")).toBe(true);
      expect(document.querySelector("#drop-checkbox")?.hasAttribute("data-polyratings-hover-target")).toBe(false);
      expect(document.querySelector("#drop")?.hasAttribute("data-polyratings-hover-target")).toBe(false);
    } finally {
      HTMLElement.prototype.getBoundingClientRect = originalRect;
    }
  });

  it("detects Shopping Cart Instructor gridcells only inside the verified cart treegrid", () => {
    document.documentElement.id = "hcx-shopping-cart";
    document.body.innerHTML = `<main><div aria-label="Classes" role="table"><div aria-label="Enrollment_Classes" role="treegrid"><div role="row"><div role="columnheader" header="Class">Class</div><div role="columnheader" header="Instructor">Instructor</div></div><div role="row" data-row-id="cart-1"><div role="gridcell" header="Class">CSC 430</div><div role="gridcell" header="Instructor" index="5"><div title="Michael Haungs"><span aria-hidden="false">Michael Haungs</span></div></div></div><div role="row" data-row-id="cart-2"><div role="gridcell" header="Class">CSC 431</div><div role="gridcell" header="Instructor" index="5"><div title="Michael Haungs"><span aria-hidden="false">Michael Haungs</span></div></div></div><div role="row" data-row-id="cart-3"><div role="gridcell" header="Class">CSC 480</div><div role="gridcell" header="Instructor" index="5"><div title="Ada Lovelace"><span aria-hidden="false">Ada Lovelace</span></div><div title="Grace Hopper"><span aria-hidden="false">Grace Hopper</span></div></div></div></div></div><div role="gridcell" header="Instructor">Unrelated instructor</div></main>`;
    const detection = findInstructorDetection(document);
    expect(detection.shoppingCartTargets).toBe(4);
    expect(detection.candidates.map((candidate) => candidate.instructorName)).toEqual([
      "Michael Haungs", "Michael Haungs", "Ada Lovelace", "Grace Hopper",
    ]);
    expect(detection.candidates.every((candidate) => candidate.element.getAttribute("title") !== null)).toBe(true);
    expect(detection.candidates.every((candidate) => candidate.sectionElement?.getAttribute("data-row-id")?.startsWith("cart-"))).toBe(true);
  });

  it("keeps Shopping Cart controls untouched while using one shared, no-close hover card", () => {
    vi.useFakeTimers();
    document.documentElement.id = "hcx-shopping-cart";
    const integration = setFixture(`<div aria-label="Classes" role="table"><div aria-label="Enrollment_Classes" role="treegrid"><div role="row"><div role="columnheader" header="Instructor">Instructor</div></div><div role="row" data-row-id="cart-1"><div role="gridcell" header="Instructor"><div title="Michael Haungs"><span aria-hidden="false">Michael Haungs</span></div></div><button id="remove-class" type="button">Remove class</button></div></div></div>`);
    const target = document.querySelector<HTMLElement>("[title='Michael Haungs']")!;
    const control = document.querySelector<HTMLButtonElement>("#remove-class")!;
    const host = document.querySelector<HTMLElement>("#polyratings-hover-host")!;
    expect(target.getAttribute("data-polyratings-hover-target")).toBe("true");

    target.dispatchEvent(new Event("pointerenter"));
    vi.advanceTimersByTime(250);
    expect(host.hidden).toBe(false);
    expect(host.shadowRoot?.querySelector(".close")).toBeNull();
    expect(host.shadowRoot?.textContent).toContain("Michael Haungs");

    target.dispatchEvent(new Event("pointerleave"));
    host.shadowRoot?.querySelector(".card")?.dispatchEvent(new Event("pointerenter"));
    vi.advanceTimersByTime(200);
    expect(host.hidden).toBe(false);
    host.shadowRoot?.querySelector(".card")?.dispatchEvent(new Event("pointerleave"));
    vi.advanceTimersByTime(200);
    expect(host.hidden).toBe(true);

    target.dispatchEvent(new Event("focus"));
    expect(host.hidden).toBe(false);
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
    expect(host.hidden).toBe(true);

    target.click();
    const outsideEvent = new Event("pointerdown", { bubbles: true, cancelable: true, composed: true });
    control.dispatchEvent(outsideEvent);
    expect(host.hidden).toBe(true);
    expect(outsideEvent.defaultPrevented).toBe(false);
    integration.stop();
  });

  it("opens the existing course card from a verified Shopping Cart Class value", () => {
    vi.useFakeTimers();
    document.documentElement.id = "hcx-shopping-cart";
    document.body.innerHTML = `<div aria-label="Classes" role="table"><div aria-label="Enrollment_Classes" role="treegrid"><div role="row"><div role="columnheader" header="Class">Class</div><div role="columnheader" header="Description">Description</div><div role="columnheader" header="Instructor">Instructor</div></div><div role="row" data-row-id="3580"><div role="rowheader" header="Class"><div title="CSC 3710">CSC 3710</div></div><div role="gridcell" header="Description"><div title="Game Design and Development">Game Design and Development</div></div><div role="gridcell" header="Instructor"><div title="Michael Haungs"><span aria-hidden="false">Michael Haungs</span></div></div><input id="cart-checkbox" type="checkbox" aria-label="CSC 3710"></div></div></div>`;
    const courses = findCourseRows(document);
    expect(courses).toHaveLength(1);
    expect(courses[0].course).toEqual({ code: "CSC 3710", title: "Game Design and Development" });
    expect(courses[0].source).toBe("shopping-cart");
    expect(courses[0].instructors.map((instructor) => instructor.displayName)).toEqual(["Michael Haungs"]);

    const integration = new StudentCenterIntegration({ document, professors: [professor], useMockData: false });
    integration.start();
    const target = document.querySelector<HTMLElement>("[title='CSC 3710']")!;
    const checkbox = document.querySelector<HTMLInputElement>("#cart-checkbox")!;
    const host = document.querySelector<HTMLElement>("#polyratings-hover-host")!;
    expect(target.getAttribute("data-polyratings-course-hover-target")).toBe("true");
    expect(checkbox.hasAttribute("data-polyratings-course-hover-target")).toBe(false);

    target.dispatchEvent(new Event("pointerenter"));
    vi.advanceTimersByTime(250);
    expect(host.hidden).toBe(false);
    expect(host.shadowRoot?.textContent).toContain("CSC 3710");
    expect(host.shadowRoot?.textContent).toContain("Game Design and Development");
    expect(host.shadowRoot?.textContent).toContain("Michael Haungs");
    expect(host.shadowRoot?.textContent).toContain("Rating unavailable");
    integration.stop();
  });

  it("binds dynamically added and updated Shopping Cart instructor values without duplicates", async () => {
    vi.useFakeTimers();
    document.documentElement.id = "hcx-shopping-cart";
    const integration = setFixture(`<div aria-label="Classes" role="table"><div aria-label="Enrollment_Classes" role="treegrid"><div role="row"><div role="columnheader" header="Class">Class</div><div role="columnheader" header="Description">Description</div><div role="columnheader" header="Instructor">Instructor</div></div><div id="cart-rows"></div></div></div>`);
    document.querySelector("#cart-rows")?.insertAdjacentHTML("beforeend", `<div role="row" data-row-id="cart-1"><div role="rowheader" header="Class"><div id="cart-course" title="CSC 430">CSC 430</div></div><div role="gridcell" header="Description"><div title="Software Engineering">Software Engineering</div></div><div role="gridcell" header="Instructor"><div id="cart-professor" title="Michael Haungs"><span aria-hidden="false">Michael Haungs</span></div></div></div>`);
    await Promise.resolve();
    vi.advanceTimersByTime(50);
    const target = document.querySelector<HTMLElement>("#cart-professor")!;
    expect(target.getAttribute("data-polyratings-hover-target")).toBe("true");
    expect(document.querySelector("#cart-course")?.getAttribute("data-polyratings-course-hover-target")).toBe("true");
    integration.scan();
    expect(document.querySelectorAll("[data-polyratings-hover-target]")).toHaveLength(1);
    expect(document.querySelectorAll("[data-polyratings-course-hover-target]")).toHaveLength(1);

    target.setAttribute("title", "Grace Hopper");
    target.querySelector("span")!.textContent = "Grace Hopper";
    await Promise.resolve();
    vi.advanceTimersByTime(50);
    target.dispatchEvent(new Event("pointerenter"));
    vi.advanceTimersByTime(250);
    expect(document.querySelector("#polyratings-hover-host")?.shadowRoot?.textContent).toContain("Grace Hopper");
    integration.stop();
  });

  it("detects main My Schedule rows from an Instructor table header without expanding details", () => {
    document.body.innerHTML = `<div aria-label="Class Schedule"><table><thead><tr><th>Section</th><th>Instructor</th><th>Days</th></tr></thead><tbody><tr><td>S01-LEC</td><td><span>Dr. Ada<br>Lovelace</span></td><td>MoWeFr</td></tr><tr><td>S02-LAB</td><td>Dr. Grace Hopper</td><td>TuTh</td></tr><tr><td>S03-LEC</td><td>Dr. Ada Lovelace</td><td>MoWeFr</td></tr></tbody></table></div>`;
    const detection = findInstructorDetection(document);
    expect(detection.myScheduleMainRowTargets).toBe(3);
    expect(detection.myScheduleExpandedDetailTargets).toBe(0);
    expect(detection.candidates.map((candidate) => candidate.instructorName)).toEqual([
      "Dr. Ada Lovelace", "Dr. Grace Hopper", "Dr. Ada Lovelace",
    ]);
  });

  it("detects verified My Schedule desktop treegrid instructor cells without binding Days", () => {
    document.body.innerHTML = `<main aria-label="Class Schedule" role="treegrid"><div role="row"><div role="columnheader">Class</div><div><div role="columnheader"><span>Instructor</span></div><div role="columnheader">Days</div></div></div><div role="row" data-row-id="class_schedule-3291"><div role="gridcell" header="Class">CSC 4880</div><div><div role="gridcell" header="Instructor"><div><span aria-hidden="false">Dr. Ada Lovelace</span></div></div><div role="gridcell" header="Days">TuTh</div></div></div><div role="row" data-row-id="class_schedule-3292"><div role="gridcell" header="Class">CSC 430</div><div><div role="gridcell" header="Instructor"><div><span aria-hidden="false">Dr. Grace Hopper</span></div></div><div role="gridcell" header="Days">MoWeFr</div></div></div></main>`;
    const detection = findInstructorDetection(document);
    expect(detection.myScheduleMainRowTargets).toBe(2);
    expect(detection.candidates.map((candidate) => candidate.instructorName)).toEqual(["Dr. Ada Lovelace", "Dr. Grace Hopper"]);

    const integration = new StudentCenterIntegration({ document, professors: [professor], useMockData: true });
    integration.start();
    const targets = document.querySelectorAll<HTMLElement>("[data-polyratings-hover-target]");
    expect([...targets].map((target) => target.textContent)).toEqual(["Dr. Ada Lovelace", "Dr. Grace Hopper"]);
    expect(document.querySelector("[header='Days'][data-polyratings-hover-target]")).toBeNull();
    integration.stop();
  });

  it("detects Schedule Builder section-table rows through their Instructor column", () => {
    document.body.innerHTML = `<div aria-label="Section List" role="group"><div role="grid"><div role="row"><div role="columnheader">Section</div><div role="columnheader">Instructor</div></div><div role="row"><div role="gridcell">S01-LEC</div><div role="gridcell">Dr. Grace Hopper</div></div><div role="row"><div role="gridcell">S02-LAB</div><div role="gridcell">Dr. Grace Hopper</div></div></div></div>`;
    const detection = findInstructorDetection(document);
    expect(detection.scheduleBuilderTargets).toBe(2);
    expect(detection.candidates.map((candidate) => candidate.instructorName)).toEqual(["Dr. Grace Hopper", "Dr. Grace Hopper"]);
  });

  it("detects the verified desktop Schedule Builder table with nested header and cell wrappers", () => {
    document.body.innerHTML = `<div aria-label="Sections List" role="table"><div role="row"><div><div role="columnheader"><button type="button"><p>section</p></button></div></div><div><div><div role="columnheader"><button type="button"><p>instructor</p></button></div><div role="columnheader"><button type="button"><p>days</p></button></div></div></div></div><div role="row"><div><div role="cell">S01-LEC</div></div><div><div><div role="cell">Dr. Ada Lovelace</div></div><div role="cell">MoWeFr</div></div></div><div role="row"><div><div role="cell">S02-LAB</div></div><div><div><div role="cell">Dr. Ada Lovelace</div></div><div role="cell">TuTh</div></div></div></div></div>`;
    const detection = findInstructorDetection(document);
    expect(detection.scheduleBuilderTargets).toBe(2);
    expect(detection.candidates.map((candidate) => candidate.instructorName)).toEqual(["Dr. Ada Lovelace", "Dr. Ada Lovelace"]);
    const integration = new StudentCenterIntegration({ document, professors: [professor], useMockData: true });
    integration.start();
    const targets = document.querySelectorAll<HTMLElement>("[data-polyratings-hover-target]");
    expect(targets).toHaveLength(2);
    expect([...targets].every((target) => target.getAttribute("role") === "cell")).toBe(true);
    expect([...targets].every((target) => target.textContent === "Dr. Ada Lovelace")).toBe(true);
    expect(document.querySelector("[role='row'][data-polyratings-hover-target]")).toBeNull();
    integration.stop();
  });

  it("compares every visible instructor from the Schedule Builder Select Sections destination", () => {
    const secondProfessor: Professor = {
      ...professor,
      id: "fixture-grace",
      name: "Grace Hopper",
      firstName: "Grace",
      lastName: "Hopper",
      starRating: 4,
      clarityRating: 4,
      reviewCount: 8,
      traits: ["labs"],
    };
    document.body.innerHTML = `<form><div><h2 id="section-course-heading">CSC 4880 - Artificial Intelligence</h2></div><div aria-label="Sections List" role="table"><div role="row"><div><div role="columnheader">Section</div></div><div><div role="columnheader"><button type="button"><p>Instructor</p></button></div></div></div><div role="row"><div><div role="cell">S01-LEC</div></div><div><div role="cell">Dr. Ada Lovelace</div></div></div><div role="row"><div><div role="cell">S02-LAB</div></div><div><div role="cell">Dr. Grace Hopper</div></div></div></div></form>`;
    const rows = findCourseRows(document);
    expect(rows).toHaveLength(1);
    expect(rows[0].course).toEqual({ code: "CSC 4880", title: "Artificial Intelligence" });
    expect(rows[0].instructors.map((instructor) => instructor.displayName)).toEqual(["Dr. Ada Lovelace", "Dr. Grace Hopper"]);

    const integration = new StudentCenterIntegration({
      document,
      professors: [professor, secondProfessor],
      preferences: { ...createDefaultPreferences(), learningStyles: ["labs"] },
      useMockData: false,
    });
    integration.start();
    const heading = document.querySelector<HTMLElement>("#section-course-heading")!;
    expect(heading.getAttribute("data-polyratings-course-hover-target")).toBe("true");
    heading.click();
    const host = document.querySelector<HTMLElement>("#polyratings-hover-host")!;
    expect(host.shadowRoot?.textContent).toContain("Dr. Ada Lovelace");
    expect(host.shadowRoot?.textContent).toContain("Dr. Grace Hopper");
    expect(host.shadowRoot?.textContent).toContain("Grace Hopper is recommended");
    integration.stop();
  });

  it("binds each explicitly separated instructor in one dd value without adding page buttons", () => {
    const integration = setFixture(`<div aria-label="Section List" role="group"><ul><li><dl><dt>Instructor</dt><dd>Dr. Ada Lovelace; Dr. Grace Hopper</dd></dl></li></ul></div>`);
    expect(document.querySelectorAll(".polyratings-view-button")).toHaveLength(0);
    expect(document.querySelectorAll("[data-polyratings-hover-target]")).toHaveLength(1);
    expect(document.querySelector("dd")?.getAttribute("data-polyratings-hover-target")).toBe("true");
    expect(document.querySelector("li")?.hasAttribute("data-polyratings-hover-target")).toBe(false);
    integration.stop();
  });

  it("binds each visible instructor name instead of its enclosing course row", () => {
    const integration = setFixture(`<div aria-label="Section List" role="group"><ul><li><span class="prof-name" data-name="dr. ada lovelace">Dr. Ada Lovelace</span><span class="prof-name" data-name="dr. grace hopper">Dr. Grace Hopper</span></li></ul></div>`);
    const targets = document.querySelectorAll<HTMLElement>("[data-polyratings-hover-target]");
    expect(targets).toHaveLength(2);
    expect([...targets].every((target) => target.matches("span.prof-name[data-name]"))).toBe(true);
    expect(document.querySelector("li")?.hasAttribute("data-polyratings-hover-target")).toBe(false);
    integration.stop();
  });

  it("binds accessible hover targets, including wrapped and repeated names, without duplicates", () => {
    const integration = setFixture(`<div aria-label="Section List" role="group"><li data-polyratings-course-row><strong data-polyratings-course-code>CSC 4880</strong><span class="prof-name" data-name="dr. ada lovelace">Dr. Ada<br>Lovelace</span></li><li data-polyratings-course-row><span class="prof-name" data-name="dr. ada lovelace">Dr. Ada Lovelace</span></li><li><span class="prof-name" data-name="professor no match">Professor No Match</span></li></div>`);
    integration.scan();
    expect(document.querySelectorAll("[data-polyratings-hover-target]")).toHaveLength(3);
    expect(document.querySelector("[data-polyratings-hover-target]")?.getAttribute("aria-label")).toContain("Dr. Ada Lovelace");
    integration.stop();
  });

  it("detects verified My Schedule course cells, extracts a semantic title, and aggregates repeated visible sections", () => {
    document.body.innerHTML = `<main aria-label="Class Schedule" role="treegrid"><div role="row"><div role="columnheader">Class</div><div role="columnheader">Description</div><div role="columnheader">Instructor</div></div><div role="row" data-row-id="course-1"><div role="gridcell" header="Class">CSC 4880</div><div role="gridcell" header="Description">Artificial Intelligence</div><div role="gridcell" header="Instructor"><span aria-hidden="false">Dr. Ada Lovelace</span></div></div><div role="row" data-row-id="course-2"><div role="gridcell" header="Class">CSC 4880</div><div role="gridcell" header="Description">Artificial Intelligence</div><div role="gridcell" header="Instructor"><span aria-hidden="false">Dr. Grace Hopper</span></div></div></main>`;
    const courses = findCourseCandidates(document);
    expect(courses).toHaveLength(2);
    expect(courses.every((course) => course.course.code === "CSC 4880")).toBe(true);
    expect(courses.every((course) => course.course.title === "Artificial Intelligence")).toBe(true);

    const rows = findCourseRows(document);
    expect(rows).toHaveLength(2);
    expect(rows[0].visibleSectionCount).toBe(2);
    expect(rows[0].instructors.map((instructor) => instructor.displayName)).toEqual(["Dr. Ada Lovelace", "Dr. Grace Hopper"]);
  });

  it("detects a scoped Class Search course field without treating unrelated page text as a course", () => {
    document.body.innerHTML = `<main><h2>Unrelated CSC 9999 heading</h2><article><dl><dt>Class</dt><dd>CSC 3001</dd><dt>Course Title</dt><dd>Modern Application Development</dd><dt>Instructor</dt><dd><span title="Dr. Ada Lovelace"><span aria-hidden="false">Dr. Ada Lovelace</span></span></dd></dl></article></main>`;
    const courses = findCourseRows(document);
    expect(courses).toHaveLength(1);
    expect(courses[0].course).toEqual({ code: "CSC 3001", title: "Modern Application Development" });
    expect(courses[0].instructors.map((instructor) => instructor.displayName)).toEqual(["Dr. Ada Lovelace"]);
  });

  it("detects verified Schedule Builder course-selection rows and preserves course-code button clicks", () => {
    vi.useFakeTimers();
    const markup = `<div role="table"><div role="row"><div><p role="columnheader">Course</p></div><div><p role="columnheader">Course Title</p></div><div><p role="columnheader">Units</p></div></div><div role="row" data-row-id="course-3001"><div role="cell"><input aria-label="CSC 3001" type="checkbox"></div><div role="rowheader"><button id="course-code" type="button">CSC 3001</button></div><div role="cell"><p>Modern Application Development</p></div><div role="cell">4</div><button id="select-sections" type="button">Select Sections</button></div><div role="row" data-row-id="course-3710"><div role="cell"><input aria-label="CSC 3710" type="checkbox"></div><div role="rowheader"><button type="button">CSC 3710</button></div><div role="cell"><p>Game Design and Development</p></div><div role="cell">4</div></div></div>`;
    document.body.innerHTML = markup;
    const candidates = findCourseCandidates(document);
    expect(candidates.map((candidate) => candidate.course)).toEqual([
      { code: "CSC 3001", title: "Modern Application Development" },
      { code: "CSC 3710", title: "Game Design and Development" },
    ]);
    expect(candidates.every((candidate) => candidate.clickOpensCard === false)).toBe(true);

    const integration = new StudentCenterIntegration({ document, professors: [professor], useMockData: false });
    integration.start();
    const courseCode = document.querySelector<HTMLButtonElement>("#course-code")!;
    const host = document.querySelector<HTMLElement>("#polyratings-hover-host")!;
    let nativeCourseClickCount = 0;
    courseCode.addEventListener("click", () => { nativeCourseClickCount += 1; });
    courseCode.click();
    expect(nativeCourseClickCount).toBe(1);
    expect(host.hidden).toBe(true);
    // Native button accessibility stays intact; the extension adds no ARIA
    // overrides that could mask its existing Student Center behavior.
    expect(courseCode.getAttribute("aria-haspopup")).toBeNull();
    expect(courseCode.getAttribute("aria-label")).toBeNull();

    courseCode.dispatchEvent(new Event("pointerenter"));
    vi.advanceTimersByTime(250);
    expect(host.hidden).toBe(false);
    expect(host.shadowRoot?.textContent).toContain("CSC 3001");
    expect(host.shadowRoot?.textContent).toContain("Modern Application Development");
    expect(host.shadowRoot?.textContent).toContain("Select Sections for this course");
    expect(host.shadowRoot?.querySelector<HTMLButtonElement>(".compare")?.disabled).toBe(true);
    integration.stop();
  });

  it("compares the instructors in an open Schedule Builder section list using saved preferences", () => {
    const secondProfessor: Professor = {
      ...professor,
      id: "fixture-grace",
      name: "Grace Hopper",
      firstName: "Grace",
      lastName: "Hopper",
      starRating: 4,
      clarityRating: 4,
      reviewCount: 8,
      traits: ["labs"],
    };
    document.body.innerHTML = `<div role="table"><div role="row"><div role="columnheader">Course</div><div role="columnheader">Course Title</div></div><div role="row" data-row-id="course-4880"><div role="rowheader"><button id="course-code" type="button">CSC 4880</button></div><div role="cell">Artificial Intelligence</div></div></div><div aria-label="Section List" role="group"><ul><li><h3>CSC 4880 — Artificial Intelligence</h3><dl><dt>Instructor</dt><dd>Dr. Ada Lovelace; Dr. Grace Hopper</dd></dl></li></ul></div>`;
    const integration = new StudentCenterIntegration({
      document,
      professors: [professor, secondProfessor],
      preferences: { ...createDefaultPreferences(), learningStyles: ["project-heavy"] },
      useMockData: false,
    });
    integration.start();

    const target = document.querySelector<HTMLButtonElement>("#course-code")!;
    target.dispatchEvent(new Event("focus"));
    const host = document.querySelector<HTMLElement>("#polyratings-hover-host")!;
    expect(host.shadowRoot?.textContent).toContain("Dr. Ada Lovelace");
    expect(host.shadowRoot?.textContent).toContain("Dr. Grace Hopper");
    expect(host.shadowRoot?.textContent).toContain("Ada Lovelace is recommended");
    expect(host.shadowRoot?.textContent).toContain("preference fit");

    integration.updatePreferences({ ...createDefaultPreferences(), learningStyles: ["labs"] });
    expect(host.shadowRoot?.textContent).toContain("Grace Hopper is recommended");
    integration.stop();
  });

  it("shows a real PolyRatings comparison from a visible Class Search result", () => {
    document.body.innerHTML = `<main><article><dl><dt>Class</dt><dd>CSC 4880</dd><dt>Course Title</dt><dd>Artificial Intelligence</dd><dt>Instructor</dt><dd><span title="Dr. Ada Lovelace"><span aria-hidden="false">Dr. Ada Lovelace</span></span></dd></dl></article></main>`;
    const integration = new StudentCenterIntegration({
      document,
      professors: [professor],
      preferences: { ...createDefaultPreferences(), learningStyles: ["project-heavy"] },
      useMockData: false,
    });
    integration.start();

    document.querySelector<HTMLElement>("[data-polyratings-course-hover-target]")!.click();
    const host = document.querySelector<HTMLElement>("#polyratings-hover-host")!;
    expect(host.shadowRoot?.textContent).toContain("3.6 overall");
    expect(host.shadowRoot?.textContent).toContain("Ada Lovelace is recommended");
    expect(host.shadowRoot?.textContent).not.toContain("fixture data");
    integration.stop();
  });

  it("compares all visible instructors from a native Class Search course result", () => {
    const secondProfessor: Professor = {
      ...professor,
      id: "fixture-grace",
      name: "Grace Hopper",
      firstName: "Grace",
      lastName: "Hopper",
      starRating: 4,
      clarityRating: 4,
      reviewCount: 8,
      traits: ["labs"],
    };
    document.body.innerHTML = `<div><h2 id="class-search-course-heading">Artificial Intelligence <span>| CSC 4880</span></h2><table role="treegrid" aria-label="Artificial Intelligence, Computer Science 4880 Classes"><thead><tr><th role="columnheader" id="result-CLASS_SECTION">Section</th><th role="columnheader" id="result-INSTRUCTOR">Instructor</th></tr></thead><tbody><tr data-row-id="0" aria-level="1"><td role="rowheader" id="result-0_CLASS_SECTION">S01-LEC</td><td role="gridcell" id="result-0_INSTRUCTOR"><span><div aria-hidden="false">Dr. Ada Lovelace</div></span></td></tr><tr data-row-id="1" aria-level="1"><td role="rowheader" id="result-1_CLASS_SECTION">S02-LAB</td><td role="gridcell" id="result-1_INSTRUCTOR"><span><div aria-hidden="false">Dr. Grace Hopper</div></span></td></tr></tbody></table></div>`;
    const rows = findCourseRows(document);
    expect(rows).toHaveLength(1);
    expect(rows[0].course).toEqual({ code: "CSC 4880", title: "Artificial Intelligence" });
    expect(rows[0].instructors.map((instructor) => instructor.displayName)).toEqual(["Dr. Ada Lovelace", "Dr. Grace Hopper"]);

    const integration = new StudentCenterIntegration({
      document,
      professors: [professor, secondProfessor],
      preferences: { ...createDefaultPreferences(), learningStyles: ["labs"] },
      useMockData: false,
    });
    integration.start();
    const heading = document.querySelector<HTMLElement>("#class-search-course-heading")!;
    expect(heading.getAttribute("data-polyratings-course-hover-target")).toBe("true");
    heading.click();
    const host = document.querySelector<HTMLElement>("#polyratings-hover-host")!;
    expect(host.shadowRoot?.textContent).toContain("Dr. Ada Lovelace");
    expect(host.shadowRoot?.textContent).toContain("Dr. Grace Hopper");
    expect(host.shadowRoot?.textContent).toContain("Grace Hopper is recommended");
    integration.stop();
  });

  it("opens a reusable course card with visible-section disclosure and comparison", () => {
    const integration = setFixture(`<main aria-label="Class Schedule" role="treegrid"><div role="row"><div role="columnheader">Class</div><div role="columnheader">Description</div><div role="columnheader">Instructor</div></div><div role="row" data-row-id="course-1"><div role="gridcell" header="Class">CSC 4880</div><div role="gridcell" header="Description">Artificial Intelligence</div><div role="gridcell" header="Instructor"><span aria-hidden="false">Dr. Ada Lovelace</span></div></div></main>`);
    const courseTarget = document.querySelector<HTMLElement>("[data-polyratings-course-hover-target]")!;
    courseTarget.click();
    const host = document.querySelector<HTMLElement>("#polyratings-hover-host")!;
    expect(host.shadowRoot?.textContent).toContain("CSC 4880");
    expect(host.shadowRoot?.textContent).toContain("Artificial Intelligence");
    expect(host.shadowRoot?.textContent).toContain("currently visible in Student Center");
    expect(host.shadowRoot?.textContent).toContain("Ada Lovelace is recommended");
    expect(host.shadowRoot?.textContent).toContain("52% preference fit");
    expect(host.shadowRoot?.textContent).toContain("fixture data");

    host.shadowRoot?.querySelector<HTMLButtonElement>(".compare")?.click();
    expect(host.shadowRoot?.textContent).toContain("Professor comparison");
    expect(host.shadowRoot?.textContent).toContain("Matches Project-heavy");
    integration.stop();
  });

  it("uses provider-backed ratings for real Student Center course cards and switches cleanly to a professor card", () => {
    document.body.innerHTML = `<main aria-label="Class Schedule" role="treegrid"><div role="row"><div role="columnheader">Class</div><div role="columnheader">Description</div><div role="columnheader">Instructor</div></div><div role="row" data-row-id="course-1"><div role="gridcell" header="Class">CSC 4880</div><div role="gridcell" header="Description">Artificial Intelligence</div><div role="gridcell" header="Instructor"><span aria-hidden="false">Dr. Ada Lovelace</span></div></div></main>`;
    const integration = new StudentCenterIntegration({ document, professors: [professor], useMockData: false });
    integration.start();
    const courseTarget = document.querySelector<HTMLElement>("[data-polyratings-course-hover-target]")!;
    const professorTarget = document.querySelector<HTMLElement>("[data-polyratings-hover-target]")!;
    courseTarget.click();
    const host = document.querySelector<HTMLElement>("#polyratings-hover-host")!;
    expect(host.shadowRoot?.textContent).toContain("3.6 overall");
    expect(host.shadowRoot?.textContent).not.toContain("fixture data");

    professorTarget.click();
    expect(document.querySelectorAll("#polyratings-hover-host")).toHaveLength(1);
    expect(host.shadowRoot?.textContent).toContain("Personalized summary");
    integration.stop();
  });

  it("closes a course card and binds a dynamically rendered course row", async () => {
    vi.useFakeTimers();
    const integration = setFixture(`<main aria-label="Class Schedule" role="treegrid"><div role="row"><div role="columnheader">Class</div><div role="columnheader">Description</div><div role="columnheader">Instructor</div></div><div id="course-rows"></div></main>`);
    document.querySelector("#course-rows")?.insertAdjacentHTML("beforeend", `<div role="row" data-row-id="course-1"><div role="gridcell" header="Class">CSC 4880</div><div role="gridcell" header="Description">Artificial Intelligence</div><div role="gridcell" header="Instructor"><span aria-hidden="false">Dr. Ada Lovelace</span></div></div>`);
    await Promise.resolve();
    vi.advanceTimersByTime(50);
    const courseTarget = document.querySelector<HTMLElement>("[data-polyratings-course-hover-target]")!;
    expect(courseTarget).toBeTruthy();
    courseTarget.click();
    const host = document.querySelector<HTMLElement>("#polyratings-hover-host")!;
    host.shadowRoot?.querySelector<HTMLButtonElement>(".close")?.click();
    expect(host.hidden).toBe(true);
    integration.stop();
  });

  it("opens the correct delayed hover card and keeps it open when the pointer enters the card", () => {
    vi.useFakeTimers();
    const integration = setFixture(`<div aria-label="Section List" role="group"><li><span class="prof-name" data-name="dr. ada lovelace">Dr. Ada Lovelace</span></li></div>`);
    const target = document.querySelector<HTMLElement>("[data-polyratings-hover-target]")!;
    target.dispatchEvent(new Event("pointerenter"));
    vi.advanceTimersByTime(249);
    expect(document.querySelector<HTMLElement>("#polyratings-hover-host")?.hidden).toBe(true);
    vi.advanceTimersByTime(1);
    const host = document.querySelector<HTMLElement>("#polyratings-hover-host")!;
    expect(host.hidden).toBe(false);
    expect(host.shadowRoot?.textContent).toContain("Ada Lovelace");
    target.dispatchEvent(new Event("pointerleave"));
    host.shadowRoot?.querySelector(".card")?.dispatchEvent(new Event("pointerenter"));
    vi.advanceTimersByTime(200);
    expect(host.hidden).toBe(false);
    host.shadowRoot?.querySelector(".card")?.dispatchEvent(new Event("pointerleave"));
    vi.advanceTimersByTime(200);
    expect(host.hidden).toBe(true);
    integration.stop();
  });

  it("manually closes a hover card until its instructor target is truly left and re-entered", () => {
    vi.useFakeTimers();
    const integration = setFixture(`<div aria-label="Section List" role="group"><li><span class="prof-name" data-name="dr. ada lovelace">Dr. Ada Lovelace</span></li></div>`);
    const target = document.querySelector<HTMLElement>("[data-polyratings-hover-target]")!;
    const host = document.querySelector<HTMLElement>("#polyratings-hover-host")!;

    target.dispatchEvent(new Event("pointerenter"));
    vi.advanceTimersByTime(250);
    expect(host.hidden).toBe(false);
    // In Chrome, the card can cover the target. Closing it reveals that target
    // again and may synchronously produce a pointerenter beneath the pointer.
    target.dispatchEvent(new Event("pointerleave"));
    host.shadowRoot?.querySelector(".card")?.dispatchEvent(new Event("pointerenter"));
    const close = host.shadowRoot?.querySelector<HTMLButtonElement>(".close")!;
    const closeEvent = new Event("pointerdown", { bubbles: true, cancelable: true, composed: true });
    close.dispatchEvent(closeEvent);
    expect(host.hidden).toBe(true);
    expect(closeEvent.defaultPrevented).toBe(true);

    // A synthetic enter caused by revealing the target must not reopen it.
    target.dispatchEvent(new Event("pointerenter"));
    vi.advanceTimersByTime(250);
    expect(host.hidden).toBe(true);

    // Only a subsequent leave/re-enter starts a new hover session.
    target.dispatchEvent(new Event("pointerleave"));
    target.dispatchEvent(new Event("pointerenter"));
    vi.advanceTimersByTime(250);
    expect(host.hidden).toBe(false);
    close.click();
    expect(host.hidden).toBe(true);
    expect(host.style.display).toBe("none");
    integration.stop();
  });

  it("manually dismisses with Escape and closes click-opened cards outside without blocking page controls", () => {
    vi.useFakeTimers();
    const integration = setFixture(`<main><button id="student-center-control" type="button">Student Center control</button><div aria-label="Section List" role="group"><li><span class="prof-name" data-name="dr. ada lovelace">Dr. Ada Lovelace</span></li></div></main>`);
    const target = document.querySelector<HTMLElement>("[data-polyratings-hover-target]")!;
    const host = document.querySelector<HTMLElement>("#polyratings-hover-host")!;

    target.dispatchEvent(new Event("pointerenter"));
    vi.advanceTimersByTime(250);
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
    expect(host.hidden).toBe(true);

    target.click();
    expect(host.hidden).toBe(false);
    const control = document.querySelector<HTMLButtonElement>("#student-center-control")!;
    let controlClicked = false;
    control.addEventListener("click", () => { controlClicked = true; });
    const outsideEvent = new Event("pointerdown", { bubbles: true, cancelable: true, composed: true });
    control.dispatchEvent(outsideEvent);
    expect(host.hidden).toBe(true);
    expect(outsideEvent.defaultPrevented).toBe(false);
    control.click();
    expect(controlClicked).toBe(true);
    integration.stop();
  });

  it("keeps a single card within the viewport by opening above a bottom target and shifting left at the right edge", () => {
    const restoreViewport = setViewport(600, 600);
    const integration = setFixture(`<div aria-label="Section List" role="group"><li><span class="prof-name" data-name="dr. ada lovelace">Dr. Ada Lovelace</span></li></div>`);
    const target = document.querySelector<HTMLElement>("[data-polyratings-hover-target]")!;
    const restoreRects = mockTargetAndCardRects(target, () => rect(570, 540, 20, 20), () => rect(0, 0, 340, 300));

    target.click();
    const host = document.querySelector<HTMLElement>("#polyratings-hover-host")!;
    expect(host.style.left).toBe("252px");
    expect(host.style.top).toBe("232px");
    expect(document.querySelectorAll("#polyratings-hover-host")).toHaveLength(1);
    restoreRects.mockRestore();
    restoreViewport();
    integration.stop();
  });

  it("reuses one overlay host when moving between different professor targets", () => {
    const integration = setFixture(`<div aria-label="Section List" role="group"><li><span class="prof-name" data-name="dr. ada lovelace">Dr. Ada Lovelace</span><span class="prof-name" data-name="professor no match">Professor No Match</span></li></div>`);
    const targets = document.querySelectorAll<HTMLElement>("[data-polyratings-hover-target]");
    targets[0].click();
    const host = document.querySelector<HTMLElement>("#polyratings-hover-host")!;
    expect(host.shadowRoot?.textContent).toContain("Ada Lovelace");
    targets[1].click();
    expect(document.querySelectorAll("#polyratings-hover-host")).toHaveLength(1);
    expect(host.shadowRoot?.textContent).toContain("Professor No Match");
    integration.stop();
  });

  it("constrains tall cards and repositions the active card on scrolling and resizing", () => {
    const restoreViewport = setViewport(800, 500);
    let targetTop = 100;
    const integration = setFixture(`<div aria-label="Section List" role="group"><li><span class="prof-name" data-name="dr. ada lovelace">Dr. Ada Lovelace</span></li></div>`);
    const target = document.querySelector<HTMLElement>("[data-polyratings-hover-target]")!;
    const restoreRects = mockTargetAndCardRects(target, () => rect(100, targetTop, 80, 20), () => rect(0, 0, 340, 600));

    target.click();
    const host = document.querySelector<HTMLElement>("#polyratings-hover-host")!;
    const card = host.shadowRoot?.querySelector<HTMLElement>(".card")!;
    expect(card.style.maxHeight).toBe("420px");
    expect(card.style.height).toBe("420px");
    expect(card.style.overflowY).toBe("hidden");
    // Review content scrolls inside the card body, leaving Close in the
    // persistent header rather than allowing the entire overlay to overflow.
    expect(host.shadowRoot?.querySelector<HTMLElement>(".body")).toBeTruthy();
    expect(host.shadowRoot?.querySelector<HTMLButtonElement>(".close")).toBeTruthy();
    expect(host.style.top).toBe("8px");

    targetTop = 440;
    document.dispatchEvent(new Event("scroll"));
    expect(host.style.top).toBe("12px");

    const resizeViewport = setViewport(800, 700);
    window.dispatchEvent(new Event("resize"));
    expect(host.style.top).toBe("12px");
    resizeViewport();
    restoreRects.mockRestore();
    restoreViewport();
    integration.stop();
  });

  it("activates the shared hover card from a My Schedule main-row instructor cell", () => {
    vi.useFakeTimers();
    const integration = setFixture(`<div aria-label="Class Schedule"><table><thead><tr><th>Section</th><th>Instructor</th></tr></thead><tbody><tr><td>S01-LEC</td><td>Dr. Ada Lovelace</td></tr></tbody></table></div>`);
    const target = document.querySelector<HTMLElement>("[data-polyratings-hover-target]")!;
    target.dispatchEvent(new Event("pointerenter"));
    vi.advanceTimersByTime(250);
    expect(document.querySelector<HTMLElement>("#polyratings-hover-host")?.hidden).toBe(false);
    expect(document.querySelector<HTMLElement>("#polyratings-hover-host")?.shadowRoot?.textContent).toContain("Ada Lovelace");
    integration.stop();
  });

  it("fills in course-scoped ratings and reviews once the detail fetch resolves", async () => {
    const index: Professor = { ...professor, reviews: [], reviewCount: 2 };
    document.documentElement.setAttribute("data-polyratings-fixture", "");
    // The class on screen carries its semester number; the review is filed
    // under the quarter number, so only the crosswalk can connect them.
    document.body.innerHTML = `<div aria-label="Section List" role="group"><li><h3>CSC 4880</h3><dl><dt>Instructor</dt><dd>Lovelace,Ada</dd></dl></li></div>`;
    const quarterReview = { ...professor.reviews[0], courseCode: "CSC 480" };
    const integration = new StudentCenterIntegration({
      document,
      professors: [index],
      details: { getProfessorDetail: async () => ({ ...professor, reviews: [quarterReview] }) },
    });
    integration.start();

    document.querySelector<HTMLElement>("[data-polyratings-hover-target]")!.click();
    const host = document.querySelector<HTMLElement>("#polyratings-hover-host")!;
    expect(host.shadowRoot?.textContent).toContain("Loading CSC 4880 reviews");

    await vi.waitFor(() => expect(host.shadowRoot?.textContent).toContain("In CSC 4880: ★ 4.00 from 1 review"));
    // The header title comes from the catalog crosswalk, not from PolyRatings.
    expect(host.shadowRoot?.textContent).toContain("Artificial Intelligence");
    integration.stop();
  });

  it("keeps an open professor detail view open when reviews finish loading", async () => {
    const index: Professor = { ...professor, reviews: [] };
    document.documentElement.setAttribute("data-polyratings-fixture", "");
    document.body.innerHTML = `<div aria-label="Section List" role="group"><li><span class="prof-name" data-name="Lovelace,Ada">Lovelace,Ada</span></li></div>`;
    let release: (() => void) | undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const integration = new StudentCenterIntegration({
      document,
      professors: [index],
      details: {
        getProfessorDetail: async () => {
          await gate;
          return professor;
        },
      },
    });
    integration.start();

    document.querySelector<HTMLElement>("[data-polyratings-hover-target]")!.click();
    const host = document.querySelector<HTMLElement>("#polyratings-hover-host")!;
    host.shadowRoot?.querySelector<HTMLButtonElement>(".prof")?.click();
    expect(host.shadowRoot?.textContent).toContain("Back to professors");

    release?.();
    await vi.waitFor(() => expect(host.shadowRoot?.textContent).toContain("Clear lectures."));
    expect(host.shadowRoot?.textContent).toContain("Back to professors");
    integration.stop();
  });

  it("activates the shared hover card from a titled Class Search instructor value", () => {
    vi.useFakeTimers();
    const integration = setFixture(`<article><dl><dt>Instructor</dt><dd><div><span title="Dr. Ada Lovelace"><div aria-hidden="false">Dr. Ada Lovelace</div></span></div></dd></dl></article>`);
    const target = document.querySelector<HTMLElement>("span[title='Dr. Ada Lovelace']")!;
    expect(target.getAttribute("data-polyratings-hover-target")).toBe("true");
    target.dispatchEvent(new Event("pointerenter"));
    vi.advanceTimersByTime(250);
    expect(document.querySelector<HTMLElement>("#polyratings-hover-host")?.hidden).toBe(false);
    integration.stop();
  });

  it("activates the shared hover card from a desktop Class Search instructor value", () => {
    vi.useFakeTimers();
    const integration = setFixture(`<table><thead><tr><th role="columnheader" id="grid-SECTION">section</th><th role="columnheader" id="grid-INSTRUCTOR">instructor</th></tr></thead><tbody><tr aria-level="1"><td aria-hidden="true">expand</td><td>S01</td><td role="gridcell" id="grid-0_INSTRUCTOR"><div aria-hidden="false">Dr. Ada Lovelace</div></td></tr></tbody></table>`);
    const target = document.querySelector<HTMLElement>("td[id$='_INSTRUCTOR'] [aria-hidden='false']")!;
    expect(target.getAttribute("data-polyratings-hover-target")).toBe("true");
    target.dispatchEvent(new Event("pointerenter"));
    vi.advanceTimersByTime(250);
    expect(document.querySelector<HTMLElement>("#polyratings-hover-host")?.hidden).toBe(false);
    integration.stop();
  });

  it("supports focus, drill-in to details, Escape, and a safe no-data row", () => {
    const integration = setFixture(`<div aria-label="Section List" role="group"><li data-polyratings-course-row><strong data-polyratings-course-code>CSC 4880</strong><span class="prof-name" data-name="dr. ada lovelace">Dr. Ada Lovelace</span></li><li><span class="prof-name" data-name="professor no match">Professor No Match</span></li></div>`);
    const targets = document.querySelectorAll<HTMLElement>("[data-polyratings-hover-target]");
    targets[0].dispatchEvent(new Event("focus"));
    const host = document.querySelector<HTMLElement>("#polyratings-hover-host")!;
    expect(host.shadowRoot?.textContent).toContain("Personalized summary");

    host.shadowRoot?.querySelector<HTMLButtonElement>(".prof")?.click();
    expect(host.shadowRoot?.textContent).toContain("Reviews (2 total)");
    expect(host.shadowRoot?.textContent).toContain("Clear lectures.");

    host.shadowRoot?.querySelector<HTMLButtonElement>(".back")?.click();
    expect(host.shadowRoot?.textContent).toContain("Personalized summary");

    targets[1].click();
    expect(host.shadowRoot?.textContent).toContain("Professor No Match");
    expect(host.shadowRoot?.textContent).toContain("no ratings available yet");
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(host.hidden).toBe(true);
    integration.stop();
  });

  it("lists every professor teaching one class and re-renders when preferences change", () => {
    const second: Professor = {
      ...professor,
      id: "fixture-grace",
      name: "Grace Hopper",
      firstName: "Grace",
      lastName: "Hopper",
      traits: ["labs"],
    };
    document.documentElement.setAttribute("data-polyratings-fixture", "");
    document.body.innerHTML = `<div aria-label="Section List" role="group"><li data-polyratings-course-row><strong data-polyratings-course-code>CSC 430</strong><dl><dt>Instructor</dt><dd>Dr. Ada Lovelace; Dr. Grace Hopper</dd></dl></li></div>`;
    const integration = new StudentCenterIntegration({
      document,
      professors: [professor, second],
      preferences: { ...createDefaultPreferences(), learningStyles: ["project-heavy"] },
    });
    integration.start();

    document.querySelector<HTMLElement>("[data-polyratings-hover-target]")!.click();
    const host = document.querySelector<HTMLElement>("#polyratings-hover-host")!;
    expect(host.shadowRoot?.querySelectorAll(".prof")).toHaveLength(2);
    expect(host.shadowRoot?.textContent).toContain("Ada Lovelace fits best");

    integration.updatePreferences({ ...createDefaultPreferences(), learningStyles: ["labs"] });
    expect(host.shadowRoot?.textContent).toContain("Grace Hopper fits best");
    integration.stop();
  });

  it("detects dynamically inserted course rows", async () => {
    vi.useFakeTimers();
    const integration = setFixture("<div aria-label=\"Section List\" role=\"group\"></div>");
    document.querySelector("[aria-label='Section List']")?.insertAdjacentHTML("beforeend", `<li><span class="prof-name" data-name="dr. ada lovelace">Dr. Ada Lovelace</span></li>`);
    await Promise.resolve();
    vi.advanceTimersByTime(50);
    expect(document.querySelectorAll("[data-polyratings-hover-target]")).toHaveLength(1);
    integration.stop();
  });

  it("detects dynamically rendered Schedule Builder course-selection rows without duplicate card targets", async () => {
    vi.useFakeTimers();
    const integration = setFixture(`<div role="table"><div role="row"><p role="columnheader">Course</p><p role="columnheader">Course Title</p></div><div id="course-rows"></div></div>`);
    document.querySelector("#course-rows")?.insertAdjacentHTML("beforeend", `<div role="row" data-row-id="course-3001"><div role="cell"><input type="checkbox" aria-label="CSC 3001"></div><div role="rowheader"><button type="button">CSC 3001</button></div><div role="cell">Modern Application Development</div></div>`);
    await Promise.resolve();
    vi.advanceTimersByTime(50);
    const target = document.querySelector<HTMLElement>("[data-polyratings-course-hover-target]")!;
    expect(target.textContent).toBe("CSC 3001");
    integration.scan();
    expect(document.querySelectorAll("[data-polyratings-course-hover-target]")).toHaveLength(1);
    integration.stop();
  });

  it("detects dynamically inserted Schedule Builder Instructor fields", async () => {
    vi.useFakeTimers();
    const integration = setFixture("<div aria-label=\"Section List\" role=\"group\"><ul></ul></div>");
    document.querySelector("ul")?.insertAdjacentHTML("beforeend", `<li><dl><dt>Instructor</dt><dd>Dr. Grace Hopper</dd></dl></li>`);
    await Promise.resolve();
    vi.advanceTimersByTime(50);
    expect(document.querySelectorAll("[data-polyratings-hover-target]")).toHaveLength(1);
    expect(document.querySelector("[data-polyratings-hover-target]")?.getAttribute("aria-label")).toContain("Dr. Grace Hopper");
    integration.stop();
  });

  it("detects dynamically inserted My Schedule instructor fields", async () => {
    vi.useFakeTimers();
    const integration = setFixture("<div aria-label=\"Class Schedule\"></div>");
    document.querySelector("[aria-label='Class Schedule']")?.insertAdjacentHTML("beforeend", `<article><dl><dt>Instructor:</dt><dd><div><span aria-hidden="false">Dr. Ada Lovelace</span></div></dd></dl></article>`);
    await Promise.resolve();
    vi.advanceTimersByTime(50);
    expect(document.querySelectorAll("[data-polyratings-hover-target]")).toHaveLength(1);
    expect(document.querySelector("[data-polyratings-hover-target]")?.getAttribute("aria-label")).toContain("Dr. Ada Lovelace");
    integration.stop();
  });

  it("detects dynamically rendered My Schedule main rows", async () => {
    vi.useFakeTimers();
    const integration = setFixture("<div aria-label=\"Class Schedule\"><table><thead><tr><th>Section</th><th>Instructor</th></tr></thead><tbody></tbody></table></div>");
    document.querySelector("tbody")?.insertAdjacentHTML("beforeend", "<tr><td>S01</td><td>Dr. Ada Lovelace</td></tr>");
    await Promise.resolve();
    vi.advanceTimersByTime(50);
    expect(document.querySelectorAll("[data-polyratings-hover-target]")).toHaveLength(1);
    integration.stop();
  });

  it("detects dynamically rendered Class Search instructor fields without duplicate targets", async () => {
    vi.useFakeTimers();
    const integration = setFixture("<main id=\"class-search-results\"></main>");
    document.querySelector("#class-search-results")?.insertAdjacentHTML("beforeend", `<article><dl><dt>Instructor</dt><dd><div><span title="Dr. Ada Lovelace"><div aria-hidden="false">Dr. Ada Lovelace</div></span></div></dd></dl></article>`);
    await Promise.resolve();
    vi.advanceTimersByTime(50);
    expect(document.querySelectorAll("[data-polyratings-hover-target]")).toHaveLength(1);
    integration.scan();
    expect(document.querySelectorAll("[data-polyratings-hover-target]")).toHaveLength(1);
    integration.stop();
  });

  it("detects dynamically rendered desktop Class Search rows without duplicate targets", async () => {
    vi.useFakeTimers();
    const integration = setFixture("<table><thead><tr><th role=\"columnheader\" id=\"grid-SECTION\">section</th><th role=\"columnheader\" id=\"grid-INSTRUCTOR\">instructor</th></tr></thead><tbody></tbody></table>");
    document.querySelector("tbody")?.insertAdjacentHTML("beforeend", "<tr aria-level=\"1\"><td aria-hidden=\"true\">expand</td><td>S01</td><td role=\"gridcell\" id=\"grid-0_INSTRUCTOR\"><div aria-hidden=\"false\">Dr. Ada Lovelace</div></td></tr>");
    await Promise.resolve();
    vi.advanceTimersByTime(50);
    expect(document.querySelectorAll("[data-polyratings-hover-target]")).toHaveLength(1);
    integration.scan();
    expect(document.querySelectorAll("[data-polyratings-hover-target]")).toHaveLength(1);
    integration.stop();
  });
});

describe("saving a class from the hover card", () => {
  const cartMarkup = `<div aria-label="Classes" role="table"><div aria-label="Enrollment_Classes" role="treegrid"><div role="row"><div role="columnheader" header="Class">Class</div><div role="columnheader" header="Instructor">Instructor</div></div><div role="row" data-row-id="cart-1"><div role="gridcell" header="Class">CSC 4880</div><div role="gridcell" header="Instructor" index="5"><div title="Ada Lovelace"><span aria-hidden="false">Ada Lovelace</span></div></div></div></div></div>`;

  function openCard(options: StudentCenterIntegrationOptions) {
    document.documentElement.setAttribute("data-polyratings-fixture", "");
    document.documentElement.id = "hcx-shopping-cart";
    document.body.innerHTML = cartMarkup;
    const integration = new StudentCenterIntegration(options);
    integration.start();
    const target = document.querySelector<HTMLElement>("[title='Ada Lovelace']")!;
    target.dispatchEvent(new Event("pointerenter"));
    vi.advanceTimersByTime(250);
    const host = document.querySelector<HTMLElement>("#polyratings-hover-host")!;
    return { integration, target, host };
  }

  it("offers an unsaved class a save action naming the course", () => {
    vi.useFakeTimers();
    const { integration, host } = openCard({ document, professors: [professor] });

    const button = host.shadowRoot?.querySelector<HTMLButtonElement>(".favorite")!;
    expect(button.textContent).toContain("Save CSC 4880");
    expect(button.getAttribute("aria-pressed")).toBe("false");
    integration.stop();
  });

  it("reports the saved favorite with the top-ranked professor attached", () => {
    vi.useFakeTimers();
    const saved: Array<{ courseCode: string; professorName: string | null; isSaved: boolean }> = [];
    const { integration, host } = openCard({
      document,
      professors: [professor],
      onToggleFavorite: (favorite, isSaved) =>
        saved.push({ courseCode: favorite.courseCode, professorName: favorite.professorName, isSaved }),
    });

    host.shadowRoot?.querySelector<HTMLButtonElement>(".favorite")!.click();

    expect(saved).toEqual([{ courseCode: "CSC 4880", professorName: "Ada Lovelace", isSaved: true }]);
    integration.stop();
  });

  it("flips the control to a saved state without waiting for storage", () => {
    vi.useFakeTimers();
    const { integration, host } = openCard({ document, professors: [professor] });

    host.shadowRoot?.querySelector<HTMLButtonElement>(".favorite")!.click();

    const button = host.shadowRoot?.querySelector<HTMLButtonElement>(".favorite")!;
    expect(button.className).toContain("is-saved");
    expect(button.getAttribute("aria-pressed")).toBe("true");
    expect(button.textContent).toContain("Saved");
    integration.stop();
  });

  it("renders an already-saved class as saved on first open", () => {
    vi.useFakeTimers();
    const { integration, host } = openCard({
      document,
      professors: [professor],
      favorites: [
        {
          id: "CSC 4880::fixture-ada",
          courseCode: "CSC 4880",
          courseTitle: null,
          professorId: "fixture-ada",
          professorName: "Ada Lovelace",
          starRating: 3.6,
          clarityRating: 3.4,
          savedAt: "2026-11-16T00:00:00.000Z",
        },
      ],
    });

    expect(host.shadowRoot?.querySelector(".favorite")?.className).toContain("is-saved");
    integration.stop();
  });

  it("removes the favorite when a saved class is toggled off", () => {
    vi.useFakeTimers();
    const events: boolean[] = [];
    const { integration, host } = openCard({
      document,
      professors: [professor],
      favorites: [
        {
          id: "CSC 4880::fixture-ada",
          courseCode: "CSC 4880",
          courseTitle: null,
          professorId: "fixture-ada",
          professorName: "Ada Lovelace",
          starRating: 3.6,
          clarityRating: 3.4,
          savedAt: "2026-11-16T00:00:00.000Z",
        },
      ],
      onToggleFavorite: (_favorite, isSaved) => events.push(isSaved),
    });

    host.shadowRoot?.querySelector<HTMLButtonElement>(".favorite")!.click();

    expect(events).toEqual([false]);
    expect(host.shadowRoot?.querySelector(".favorite")?.className).not.toContain("is-saved");
    integration.stop();
  });

  it("reflects a favorite saved in the popup while the card is open", () => {
    vi.useFakeTimers();
    const { integration, host } = openCard({ document, professors: [professor] });

    integration.updateFavorites([
      {
        id: "CSC 4880::fixture-ada",
        courseCode: "CSC 4880",
        courseTitle: null,
        professorId: "fixture-ada",
        professorName: "Ada Lovelace",
        starRating: 3.6,
        clarityRating: 3.4,
        savedAt: "2026-11-16T00:00:00.000Z",
      },
    ]);

    expect(host.shadowRoot?.querySelector(".favorite")?.className).toContain("is-saved");
    integration.stop();
  });
});

describe("hover card keyboard access", () => {
  const cartMarkup = `<div aria-label="Classes" role="table"><div aria-label="Enrollment_Classes" role="treegrid"><div role="row"><div role="columnheader" header="Class">Class</div><div role="columnheader" header="Instructor">Instructor</div></div><div role="row" data-row-id="cart-1"><div role="gridcell" header="Class">CSC 4880</div><div role="gridcell" header="Instructor" index="5"><div title="Ada Lovelace"><span aria-hidden="false">Ada Lovelace</span></div></div></div></div></div>`;

  function focusOpen() {
    document.documentElement.id = "hcx-shopping-cart";
    const integration = setFixture(cartMarkup);
    const target = document.querySelector<HTMLElement>("[title='Ada Lovelace']")!;
    target.focus();
    target.dispatchEvent(new Event("focus"));
    const host = document.querySelector<HTMLElement>("#polyratings-hover-host")!;
    return { integration, target, host };
  }

  it("moves focus into the card when Tab is pressed on the row", () => {
    vi.useFakeTimers();
    const { integration, host } = focusOpen();
    expect(host.hidden).toBe(false);

    const event = new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true });
    document.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    expect(host.shadowRoot?.activeElement).not.toBeNull();
    integration.stop();
  });

  it("keeps the card open while focus is inside it", () => {
    vi.useFakeTimers();
    const { integration, target, host } = focusOpen();

    const inner = host.shadowRoot?.querySelector<HTMLElement>("button")!;
    target.dispatchEvent(new FocusEvent("blur", { relatedTarget: host }));
    host.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
    vi.advanceTimersByTime(200);

    expect(host.hidden).toBe(false);
    expect(inner).toBeTruthy();
    integration.stop();
  });

  it("hides the card when focus leaves it entirely", () => {
    vi.useFakeTimers();
    const { integration, target, host } = focusOpen();

    target.dispatchEvent(new FocusEvent("blur", { relatedTarget: document.body }));
    vi.advanceTimersByTime(200);

    expect(host.hidden).toBe(true);
    integration.stop();
  });

  it("returns focus to the row on Escape without reopening the card", () => {
    vi.useFakeTimers();
    const { integration, target, host } = focusOpen();

    const inner = host.shadowRoot?.querySelector<HTMLElement>("button")!;
    inner.focus();
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));

    expect(host.hidden).toBe(true);
    expect(document.activeElement).toBe(target);
    integration.stop();
  });
});
