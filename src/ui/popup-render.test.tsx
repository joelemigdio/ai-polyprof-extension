/** @vitest-environment jsdom */
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { Professor } from "../models/professor";
import { createDefaultPreferences } from "../models/preferences";
import { DetailScreen } from "./DetailScreen";
import { DashboardScreen } from "./DashboardScreen";
import { FavoritesScreen } from "./FavoritesScreen";
import { SearchScreen } from "./SearchScreen";

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
      <FavoritesScreen favorites={[]} onRemove={() => {}} onOpenCourse={() => {}} onBackHome={() => {}} />,
    );

    expect(markup).toContain("have not saved a course or section yet");
    expect(markup).toContain("Back to home");
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
        onBackHome={() => {}}
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
        onBackHome={() => {}}
      />,
    );

    expect(markup).toContain("CSC 2050");
    expect(markup).toContain("Saved from the Student Center");
  });

  it("labels an exact saved section alongside its instructor", () => {
    const markup = renderToStaticMarkup(
      <FavoritesScreen
        favorites={[{
          id: "CSC 4880::section::S01-LEC (6155)",
          kind: "section",
          courseCode: "CSC 4880",
          courseTitle: "Artificial Intelligence",
          sectionLabel: "S01-LEC (6155)",
          classNumber: "6155",
          professorId: "ada",
          professorName: "Ada Lovelace",
          starRating: 3.6,
          clarityRating: 3.4,
          savedAt: "2026-11-16T00:00:00.000Z",
        }]}
        onRemove={() => {}}
        onOpenCourse={() => {}}
        onBackHome={() => {}}
      />,
    );

    expect(markup).toContain("Section S01-LEC (6155)");
    expect(markup).toContain('class="fit-line">Section S01-LEC (6155)');
    expect(markup).toContain("Professor: Ada Lovelace");
    expect(markup).toContain("Remove CSC 4880 S01-LEC (6155) from favorites");
  });
});

describe("SearchScreen", () => {
  it("keeps the opening view focused on starting a search", () => {
    const markup = renderToStaticMarkup(
      <SearchScreen
        courses={[{
          code: "CSC 4880",
          title: "Artificial Intelligence",
          department: "CSC",
          term: "Winter '26",
          professorIds: [professor.id],
        }]}
        professorsById={new Map([[professor.id, professor]])}
        preferences={createDefaultPreferences()}
        favoriteIds={new Set()}
        onToggleFavorite={() => {}}
        onSelectCourse={() => {}}
        onOpenPreferences={() => {}}
      />,
    );

    expect(markup).toContain("Find a class or professor");
    expect(markup).not.toContain("Suggested classes");
    expect(markup).not.toContain("Search results");
    expect(markup).not.toContain("Artificial Intelligence");
    expect(markup).not.toContain("Franz Kurfess");
  });
});

describe("DashboardScreen", () => {
  it("keeps discovery in Student Center and previews saved sections", () => {
    const markup = renderToStaticMarkup(
      <DashboardScreen
        favorites={[{
          id: "CSC 4880::section::S01-LEC (6155)",
          kind: "section",
          courseCode: "CSC 4880",
          courseTitle: "Artificial Intelligence",
          sectionLabel: "S01-LEC (6155)",
          classNumber: "6155",
          professorId: "ada",
          professorName: "Ada Lovelace",
          starRating: 3.6,
          clarityRating: 3.4,
          savedAt: "2026-11-16T00:00:00.000Z",
        }]}
        onOpenFavorites={() => {}}
      />,
    );

    expect(markup).toContain("Compare professors where you register.");
    expect(markup).toContain("Student Center");
    expect(markup).toContain("CSC 4880");
    expect(markup).toContain("Section S01-LEC (6155) • Ada Lovelace");
    expect(markup).toContain("View all");
  });
});
