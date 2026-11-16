/** @vitest-environment jsdom */
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { Professor } from "../models/professor";
import { createDefaultPreferences } from "../models/preferences";
import { DetailScreen } from "./DetailScreen";
import { FavoritesScreen } from "./FavoritesScreen";

const professor: Professor = {
  id: "ada",
  name: "Ada Lovelace",
  firstName: "Ada",
  lastName: "Lovelace",
  department: "CSC",
  courses: ["CSC 4880"],
  starRating: 3.6,
  clarityRating: 3.4,
  supportRating: 3.2,
  reviewCount: 4,
  tags: ["Uploads Slides"],
  traits: ["visual-slides"],
  weakTraits: [],
  reviews: [
    {
      id: "r1",
      courseCode: "CSC 4880",
      classYear: "Senior",
      rating: 4,
      text: "She explains well and is very helpful in office hours.",
      grade: "A",
      courseType: "Major (Required)",
      postDate: "2026-02-01T00:00:00.000Z",
    },
    {
      id: "r2",
      courseCode: "CSC 4880",
      classYear: "Junior",
      rating: 3,
      text: "Explains clearly, but it is a heavy workload every single week.",
      grade: "B",
      courseType: "Major (Required)",
      postDate: "2026-01-01T00:00:00.000Z",
    },
  ],
};

describe("DetailScreen", () => {
  const markup = renderToStaticMarkup(
    <DetailScreen professor={professor} preferences={createDefaultPreferences()} onBack={() => {}} />,
  );

  it("renders a review summary section", () => {
    expect(markup).toContain("Review Summary");
    expect(markup).toContain("2 analyzed");
  });

  it("surfaces themes, strengths, and concerns from the review text", () => {
    expect(markup).toContain("Common themes");
    expect(markup).toContain("Strengths");
    expect(markup).toContain("Explains material clearly");
    expect(markup).toContain("Concerns");
    expect(markup).toContain("Heavy workload");
  });

  it("states that no AI model produced the summary", () => {
    expect(markup).toContain("no AI model is used");
  });

  it("labels review ratings on the 0 to 4 scale", () => {
    expect(markup).toContain("out of 4");
    expect(markup).not.toContain("out of 5");
  });
});

describe("FavoritesScreen", () => {
  it("invites the student to save something when the list is empty", () => {
    const markup = renderToStaticMarkup(
      <FavoritesScreen favorites={[]} onRemove={() => {}} onOpenCourse={() => {}} onBrowse={() => {}} />,
    );

    expect(markup).toContain("have not saved any classes yet");
    expect(markup).toContain("Browse classes");
  });

  it("lists a saved class with its ratings and a remove control", () => {
    const markup = renderToStaticMarkup(
      <FavoritesScreen
        favorites={[
          {
            id: "CSC 4880::ada",
            courseCode: "CSC 4880",
            courseTitle: "Artificial Intelligence",
            professorId: "ada",
            professorName: "Ada Lovelace",
            starRating: 3.6,
            clarityRating: 3.4,
            savedAt: "2026-11-16T00:00:00.000Z",
          },
        ]}
        onRemove={() => {}}
        onOpenCourse={() => {}}
        onBrowse={() => {}}
      />,
    );

    expect(markup).toContain("CSC 4880");
    expect(markup).toContain("Artificial Intelligence");
    expect(markup).toContain("3.60");
    expect(markup).toContain("Remove CSC 4880 from favorites");
  });

  it("renders a favorite that was saved without ratings", () => {
    const markup = renderToStaticMarkup(
      <FavoritesScreen
        favorites={[
          {
            id: "CSC 2050",
            courseCode: "CSC 2050",
            courseTitle: null,
            professorId: null,
            professorName: null,
            starRating: null,
            clarityRating: null,
            savedAt: "2026-11-16T00:00:00.000Z",
          },
        ]}
        onRemove={() => {}}
        onOpenCourse={() => {}}
        onBrowse={() => {}}
      />,
    );

    expect(markup).toContain("CSC 2050");
    expect(markup).toContain("Saved from the Student Center");
  });
});
