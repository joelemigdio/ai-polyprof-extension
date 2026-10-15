/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Professor } from "../models/professor";
import { findConfidentProfessor, normalizeInstructorName } from "./professor-detection";
import { findInstructorCandidates } from "./student-center-adapter";
import { StudentCenterIntegration } from "./student-center-integration";

const professor: Professor = {
  id: "fixture-ada",
  name: "Dr. Ada Lovelace",
  department: "Computer Science",
  overallRating: 4.6,
  reviewCount: 2,
  ratingTraits: [{ name: "Clarity", score: 4.7 }],
  reviews: [{ id: "review-1", courseCode: "CSC 4880", submittedAt: "2026-01-01", rating: 5, text: "Clear lectures.", tags: ["Clear lectures"] }],
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
  document.head.querySelector("[data-polyratings-content-styles]")?.remove();
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

  it("adds a separate button for each explicitly separated instructor in one dd value", () => {
    const integration = setFixture(`<div aria-label="Section List" role="group"><ul><li><dl><dt>Instructor</dt><dd>Dr. Ada Lovelace; Dr. Grace Hopper</dd></dl></li></ul></div>`);
    expect(document.querySelectorAll(".polyratings-view-button")).toHaveLength(2);
    expect(document.querySelectorAll<HTMLButtonElement>(".polyratings-view-button")[1].getAttribute("aria-label")).toContain("Dr. Grace Hopper");
    integration.stop();
  });

  it("adds one accessible button per instructor, including wrapped and repeated names, without duplicates", () => {
    const integration = setFixture(`<div aria-label="Section List" role="group"><li data-polyratings-course-row><strong data-polyratings-course-code>CSC 4880</strong><span class="prof-name" data-name="dr. ada lovelace">Dr. Ada<br>Lovelace</span></li><li data-polyratings-course-row><span class="prof-name" data-name="dr. ada lovelace">Dr. Ada Lovelace</span></li><li><span class="prof-name" data-name="professor no match">Professor No Match</span></li></div>`);
    integration.scan();
    expect(document.querySelectorAll(".polyratings-view-button")).toHaveLength(3);
    expect(document.querySelector(".polyratings-view-button")?.getAttribute("aria-label")).toContain("Dr. Ada Lovelace");
    integration.stop();
  });

  it("opens matching details and a safe no-data state", () => {
    const integration = setFixture(`<div aria-label="Section List" role="group"><li data-polyratings-course-row><strong data-polyratings-course-code>CSC 4880</strong><span class="prof-name" data-name="dr. ada lovelace">Dr. Ada Lovelace</span></li><li><span class="prof-name" data-name="professor no match">Professor No Match</span></li></div>`);
    const buttons = document.querySelectorAll<HTMLButtonElement>(".polyratings-view-button");
    buttons[0].click();
    expect(document.querySelector(".polyratings-overlay")?.textContent).toContain("Dr. Ada Lovelace");
    document.querySelector<HTMLButtonElement>(".polyratings-close-button")?.click();
    buttons[1].click();
    expect(document.querySelector(".polyratings-overlay")?.textContent).toContain("No PolyRatings information available");
    integration.stop();
  });

  it("detects dynamically inserted course rows", async () => {
    vi.useFakeTimers();
    const integration = setFixture("<div aria-label=\"Section List\" role=\"group\"></div>");
    document.querySelector("[aria-label='Section List']")?.insertAdjacentHTML("beforeend", `<li><span class="prof-name" data-name="dr. ada lovelace">Dr. Ada Lovelace</span></li>`);
    await Promise.resolve();
    vi.advanceTimersByTime(50);
    expect(document.querySelectorAll(".polyratings-view-button")).toHaveLength(1);
    integration.stop();
  });

  it("detects dynamically inserted Schedule Builder Instructor fields", async () => {
    vi.useFakeTimers();
    const integration = setFixture("<div aria-label=\"Section List\" role=\"group\"><ul></ul></div>");
    document.querySelector("ul")?.insertAdjacentHTML("beforeend", `<li><dl><dt>Instructor</dt><dd>Dr. Grace Hopper</dd></dl></li>`);
    await Promise.resolve();
    vi.advanceTimersByTime(50);
    expect(document.querySelectorAll(".polyratings-view-button")).toHaveLength(1);
    expect(document.querySelector(".polyratings-view-button")?.getAttribute("aria-label")).toContain("Dr. Grace Hopper");
    integration.stop();
  });
});
