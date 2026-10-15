/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Professor } from "../models/professor";
import { findConfidentProfessor, normalizeInstructorName } from "./professor-detection";
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
  it("adds one accessible button per instructor, including wrapped names, without duplicates", () => {
    const integration = setFixture(`<section data-polyratings-course-row><strong data-polyratings-course-code>CSC 4880</strong><span data-polyratings-instructor>Dr. Ada<br>Lovelace</span></section><section data-polyratings-course-row><span data-polyratings-instructor>Professor No Match</span></section>`);
    integration.scan();
    expect(document.querySelectorAll(".polyratings-view-button")).toHaveLength(2);
    expect(document.querySelector(".polyratings-view-button")?.getAttribute("aria-label")).toContain("Dr. Ada Lovelace");
    integration.stop();
  });

  it("opens matching details and a safe no-data state", () => {
    const integration = setFixture(`<section data-polyratings-course-row><strong data-polyratings-course-code>CSC 4880</strong><span data-polyratings-instructor>Dr. Ada Lovelace</span></section><section data-polyratings-course-row><span data-polyratings-instructor>Professor No Match</span></section>`);
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
    const integration = setFixture("<main></main>");
    document.querySelector("main")?.insertAdjacentHTML("beforeend", `<section data-polyratings-course-row><span data-polyratings-instructor>Dr. Ada Lovelace</span></section>`);
    await Promise.resolve();
    vi.advanceTimersByTime(50);
    expect(document.querySelectorAll(".polyratings-view-button")).toHaveLength(1);
    integration.stop();
  });
});
