/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Professor } from "../models/professor";
import { createDefaultPreferences } from "../models/preferences";
import { findConfidentProfessor, normalizeInstructorName } from "./professor-detection";
import { findInstructorCandidates, findInstructorDetection } from "./student-center-adapter";
import { StudentCenterIntegration } from "./student-center-integration";

const professor: Professor = {
  id: "fixture-ada",
  name: "Dr. Ada Lovelace",
  department: "Computer Science",
  courses: ["CSC 4880"],
  starRating: 4.6,
  peerRating: 4.4,
  reviewCount: 2,
  traits: ["project-heavy", "clear-grading"],
  weakTraits: [],
  reviews: [{ id: "review-1", courseCode: "CSC 4880", classYear: "Senior", rating: 5, text: "Clear lectures." }],
};

function setFixture(markup: string): StudentCenterIntegration {
  document.documentElement.setAttribute("data-polyratings-fixture", "");
  document.body.innerHTML = markup;
  const integration = new StudentCenterIntegration({ document, professors: [professor], useMockData: true });
  integration.start();
  return integration;
}

afterEach(() => {
  document.documentElement.removeAttribute("data-polyratings-fixture");
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

  it("detects main My Schedule rows from an Instructor table header without expanding details", () => {
    document.body.innerHTML = `<div aria-label="Class Schedule"><table><thead><tr><th>Section</th><th>Instructor</th><th>Days</th></tr></thead><tbody><tr><td>S01-LEC</td><td><span>Dr. Ada<br>Lovelace</span></td><td>MoWeFr</td></tr><tr><td>S02-LAB</td><td>Dr. Grace Hopper</td><td>TuTh</td></tr><tr><td>S03-LEC</td><td>Dr. Ada Lovelace</td><td>MoWeFr</td></tr></tbody></table></div>`;
    const detection = findInstructorDetection(document);
    expect(detection.myScheduleMainRowTargets).toBe(3);
    expect(detection.myScheduleExpandedDetailTargets).toBe(0);
    expect(detection.candidates.map((candidate) => candidate.instructorName)).toEqual([
      "Dr. Ada Lovelace", "Dr. Grace Hopper", "Dr. Ada Lovelace",
    ]);
  });

  it("detects Schedule Builder section-table rows through their Instructor column", () => {
    document.body.innerHTML = `<div aria-label="Section List" role="group"><div role="grid"><div role="row"><div role="columnheader">Section</div><div role="columnheader">Instructor</div></div><div role="row"><div role="gridcell">S01-LEC</div><div role="gridcell">Dr. Grace Hopper</div></div><div role="row"><div role="gridcell">S02-LAB</div><div role="gridcell">Dr. Grace Hopper</div></div></div></div>`;
    const detection = findInstructorDetection(document);
    expect(detection.scheduleBuilderTargets).toBe(2);
    expect(detection.candidates.map((candidate) => candidate.instructorName)).toEqual(["Dr. Grace Hopper", "Dr. Grace Hopper"]);
  });

  it("binds each explicitly separated instructor in one dd value without adding page buttons", () => {
    const integration = setFixture(`<div aria-label="Section List" role="group"><ul><li><dl><dt>Instructor</dt><dd>Dr. Ada Lovelace; Dr. Grace Hopper</dd></dl></li></ul></div>`);
    expect(document.querySelectorAll(".polyratings-view-button")).toHaveLength(0);
    expect(document.querySelectorAll("[data-polyratings-hover-target]")).toHaveLength(1);
    integration.stop();
  });

  it("binds accessible hover targets, including wrapped and repeated names, without duplicates", () => {
    const integration = setFixture(`<div aria-label="Section List" role="group"><li data-polyratings-course-row><strong data-polyratings-course-code>CSC 4880</strong><span class="prof-name" data-name="dr. ada lovelace">Dr. Ada<br>Lovelace</span></li><li data-polyratings-course-row><span class="prof-name" data-name="dr. ada lovelace">Dr. Ada Lovelace</span></li><li><span class="prof-name" data-name="professor no match">Professor No Match</span></li></div>`);
    integration.scan();
    expect(document.querySelectorAll("[data-polyratings-hover-target]")).toHaveLength(3);
    expect(document.querySelector("[data-polyratings-hover-target]")?.getAttribute("aria-label")).toContain("Dr. Ada Lovelace");
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
    expect(host.shadowRoot?.textContent).toContain("Dr. Ada Lovelace");
    target.dispatchEvent(new Event("pointerleave"));
    host.shadowRoot?.querySelector(".card")?.dispatchEvent(new Event("pointerenter"));
    vi.advanceTimersByTime(200);
    expect(host.hidden).toBe(false);
    host.shadowRoot?.querySelector(".card")?.dispatchEvent(new Event("pointerleave"));
    vi.advanceTimersByTime(140);
    expect(host.hidden).toBe(true);
    integration.stop();
  });

  it("activates the shared hover card from a My Schedule main-row instructor cell", () => {
    vi.useFakeTimers();
    const integration = setFixture(`<div aria-label="Class Schedule"><table><thead><tr><th>Section</th><th>Instructor</th></tr></thead><tbody><tr><td>S01-LEC</td><td>Dr. Ada Lovelace</td></tr></tbody></table></div>`);
    const target = document.querySelector<HTMLElement>("[data-polyratings-hover-target]")!;
    target.dispatchEvent(new Event("pointerenter"));
    vi.advanceTimersByTime(250);
    expect(document.querySelector<HTMLElement>("#polyratings-hover-host")?.hidden).toBe(false);
    expect(document.querySelector<HTMLElement>("#polyratings-hover-host")?.shadowRoot?.textContent).toContain("Dr. Ada Lovelace");
    integration.stop();
  });

  it("supports focus, drill-in to details, Escape, and a safe no-data row", () => {
    const integration = setFixture(`<div aria-label="Section List" role="group"><li data-polyratings-course-row><strong data-polyratings-course-code>CSC 4880</strong><span class="prof-name" data-name="dr. ada lovelace">Dr. Ada Lovelace</span></li><li><span class="prof-name" data-name="professor no match">Professor No Match</span></li></div>`);
    const targets = document.querySelectorAll<HTMLElement>("[data-polyratings-hover-target]");
    targets[0].dispatchEvent(new Event("focus"));
    const host = document.querySelector<HTMLElement>("#polyratings-hover-host")!;
    expect(host.shadowRoot?.textContent).toContain("Personalized summary");

    host.shadowRoot?.querySelector<HTMLButtonElement>(".prof")?.click();
    expect(host.shadowRoot?.textContent).toContain("Top reviews");
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
      name: "Dr. Grace Hopper",
      traits: ["labs"],
    };
    document.documentElement.setAttribute("data-polyratings-fixture", "");
    document.body.innerHTML = `<div aria-label="Section List" role="group"><li data-polyratings-course-row><strong data-polyratings-course-code>CSC 430</strong><dl><dt>Instructor</dt><dd>Dr. Ada Lovelace; Dr. Grace Hopper</dd></dl></li></div>`;
    const integration = new StudentCenterIntegration({
      document,
      professors: [professor, second],
      useMockData: true,
      preferences: { ...createDefaultPreferences(), learningStyles: ["project-heavy"] },
    });
    integration.start();

    document.querySelector<HTMLElement>("[data-polyratings-hover-target]")!.click();
    const host = document.querySelector<HTMLElement>("#polyratings-hover-host")!;
    expect(host.shadowRoot?.querySelectorAll(".prof")).toHaveLength(2);
    expect(host.shadowRoot?.textContent).toContain("Dr. Ada Lovelace fits best");

    integration.updatePreferences({ ...createDefaultPreferences(), learningStyles: ["labs"] });
    expect(host.shadowRoot?.textContent).toContain("Dr. Grace Hopper fits best");
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
});
