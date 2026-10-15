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

  it("supports focus, click, Escape, full details, and a safe no-data card", () => {
    const integration = setFixture(`<div aria-label="Section List" role="group"><li data-polyratings-course-row><strong data-polyratings-course-code>CSC 4880</strong><span class="prof-name" data-name="dr. ada lovelace">Dr. Ada Lovelace</span></li><li><span class="prof-name" data-name="professor no match">Professor No Match</span></li></div>`);
    const targets = document.querySelectorAll<HTMLElement>("[data-polyratings-hover-target]");
    targets[0].dispatchEvent(new Event("focus"));
    const host = document.querySelector<HTMLElement>("#polyratings-hover-host")!;
    expect(host.shadowRoot?.textContent).toContain("Review Summary");
    host.shadowRoot?.querySelector<HTMLButtonElement>(".details")?.click();
    expect(document.querySelector(".polyratings-overlay")?.textContent).toContain("Dr. Ada Lovelace");
    document.querySelector(".polyratings-overlay")?.remove();
    targets[1].click();
    expect(host.shadowRoot?.textContent).toContain("Professor No Match");
    expect(host.shadowRoot?.textContent).toContain("PolyRatings information is not available yet.");
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(host.hidden).toBe(true);
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
});
