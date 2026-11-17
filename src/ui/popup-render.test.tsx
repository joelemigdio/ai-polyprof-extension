/** @vitest-environment jsdom */
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { Professor } from "../models/professor";
import { createDefaultPreferences } from "../models/preferences";
import { ComparisonScreen } from "./ComparisonScreen";
import { DetailScreen } from "./DetailScreen";
import { DashboardScreen } from "./DashboardScreen";
import { ResultsScreen } from "./ResultsScreen";
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

describe("ResultsScreen recommendation panel", () => {
  const course = {
    code: "CSC 357",
    title: "Computer Systems",
    department: "CSC",
    term: "Winter '26",
    professorIds: ["ada", "grace"],
  };
  const grace: Professor = {
    ...professor,
    id: "grace",
    name: "Grace Hopper",
    firstName: "Grace",
    lastName: "Hopper",
    starRating: 3.1,
    clarityRating: 2.9,
    supportRating: 3.4,
    reviewCount: 2,
    tags: ["Tough Grader"],
    traits: [],
    reviews: [],
  };

  function render(preferences = createDefaultPreferences()) {
    return renderToStaticMarkup(
      <ResultsScreen
        course={course}
        professors={[professor, grace]}
        preferences={preferences}
        onSelectProfessor={() => {}}
        onCompare={() => {}}
        onBack={() => {}}
      />,
    );
  }

  it("names the cohort, the rating, and the sample size", () => {
    const markup = render({ ...createDefaultPreferences(), classStanding: "Senior" });

    expect(markup).toContain("reviews");
    expect(markup).toMatch(/rated .* out of 4/);
  });

  it("states the preference factors that were applied", () => {
    expect(render()).toContain("Matches");
  });

  it("shows a confidence badge when the evidence is caveated", () => {
    expect(render()).toContain("confidence");
  });

  it("prompts for a class standing when none is set", () => {
    expect(render()).toContain("class standing");
  });

  it("does not prompt for a class standing once one is set", () => {
    const markup = render({ ...createDefaultPreferences(), classStanding: "Senior" });

    expect(markup).not.toContain("Add your class standing");
  });

  it("offers Compare when more than one professor teaches the class", () => {
    expect(render()).toContain("Compare");
    expect(render()).not.toContain("disabled");
  });

  it("disables Compare when only one professor teaches the class", () => {
    const markup = renderToStaticMarkup(
      <ResultsScreen
        course={course}
        professors={[professor]}
        preferences={createDefaultPreferences()}
        onSelectProfessor={() => {}}
        onCompare={() => {}}
        onBack={() => {}}
      />,
    );

    expect(markup).toContain("disabled");
  });
});

describe("ComparisonScreen", () => {
  const course = {
    code: "CSC 357",
    title: "Computer Systems",
    department: "CSC",
    term: "Winter '26",
    professorIds: ["ada", "grace"],
  };
  const grace: Professor = {
    ...professor,
    id: "grace",
    name: "Grace Hopper",
    starRating: 3.9,
    clarityRating: 2.9,
    supportRating: 3.9,
    reviewCount: 2,
    tags: ["Tough Grader"],
    reviews: [],
  };

  const markup = renderToStaticMarkup(
    <ComparisonScreen course={course} professors={[professor, grace]} onBack={() => {}} />,
  );

  it("compares on the metrics PolyRatings actually measures", () => {
    expect(markup).toContain("Overall");
    expect(markup).toContain("Presents clearly");
    expect(markup).toContain("Recognizes struggles");
  });

  it("never labels the support score as difficulty", () => {
    expect(markup).not.toContain("Difficulty");
    expect(markup).toContain("not how hard the course is");
  });

  it("shows every compared professor with their review count", () => {
    expect(markup).toContain("Ada Lovelace");
    expect(markup).toContain("Grace Hopper");
    expect(markup).toContain("4 reviews");
    expect(markup).toContain("2 reviews");
  });

  it("marks the leader on a metric the professors differ on", () => {
    expect(markup).toContain("is-leader");
  });

  it("marks no leader when only one professor is compared", () => {
    const single = renderToStaticMarkup(
      <ComparisonScreen course={course} professors={[professor]} onBack={() => {}} />,
    );

    expect(single).not.toContain("is-leader");
  });

  it("handles a class with no professor data", () => {
    const empty = renderToStaticMarkup(
      <ComparisonScreen course={course} professors={[]} onBack={() => {}} />,
    );

    expect(empty).toContain("No professor information is available");
  });
});
