import type { CourseOffering, Professor, ProfessorReview } from "../models/professor";
import type { ProfessorDataService } from "./professor-data-service";

/**
 * Demonstration data for the extension popup only. The in-page hover card reads
 * real PolyRatings data via `polyratingsDataService`; this file exists because
 * the popup's browse-by-course screens have not been migrated yet.
 *
 * Ratings, review text, and review counts here are invented. Scores use
 * PolyRatings' 0-4 scale and tags use its real vocabulary so the shapes match.
 */
function review(fields: Omit<ProfessorReview, "grade" | "courseType" | "postDate"> & Partial<ProfessorReview>): ProfessorReview {
  return { grade: "A", courseType: "Major (Required)", postDate: "2026-01-15T00:00:00.000Z", ...fields };
}

const mockProfessors: Professor[] = [
  {
    id: "franz-kurfess",
    name: "Franz Kurfess",
    firstName: "Franz",
    lastName: "Kurfess",
    department: "CSC",
    courses: ["CSC 480", "CSC 466", "CSC 349"],
    starRating: 3.3,
    clarityRating: 3.8,
    supportRating: 3.4,
    reviewCount: 96,
    tags: ["Uploads Slides", "Recorded Lectures"],
    traits: ["visual-slides"],
    weakTraits: [],
    reviews: [
      review({
        id: "kurfess-csc-480",
        courseCode: "CSC 480",
        classYear: "Senior",
        rating: 3.6,
        text: "The term project drives the whole course and the rubric is published up front, so you always know where you stand.",
      }),
      review({
        id: "kurfess-csc-466",
        courseCode: "CSC 466",
        classYear: "Junior",
        rating: 3.2,
        text: "Grading criteria are unusually clear. Lectures move quickly, but the assignments reinforce the material well.",
      }),
    ],
  },
  {
    id: "john-clements",
    name: "John Clements",
    firstName: "John",
    lastName: "Clements",
    department: "CSC",
    courses: ["CSC 135", "CSC 430", "CSC 431"],
    starRating: 3.0,
    clarityRating: 3.6,
    supportRating: 3.2,
    reviewCount: 112,
    tags: ["Uploads Slides", "Fast Response Time"],
    traits: ["visual-slides", "responsive"],
    weakTraits: [],
    reviews: [
      review({
        id: "clements-csc-430",
        courseCode: "CSC 430",
        classYear: "Senior",
        rating: 3.2,
        text: "The slides are detailed enough to study from on their own, and questions in lecture get real answers rather than being deferred.",
      }),
      review({
        id: "clements-csc-135",
        courseCode: "CSC 135",
        classYear: "Sophomore",
        rating: 2.9,
        text: "Very responsive on the course forum. The pace is demanding if you have not seen the material before.",
      }),
    ],
  },
  {
    id: "maria-pantoja",
    name: "Maria Pantoja",
    firstName: "Maria",
    lastName: "Pantoja",
    department: "CPE",
    courses: ["CPE 315", "CPE 419"],
    starRating: 3.6,
    clarityRating: 3.9,
    supportRating: 3.7,
    reviewCount: 128,
    tags: ["High In-Person Availability", "Class Handouts"],
    traits: ["responsive", "visual-slides"],
    weakTraits: [],
    reviews: [
      review({
        id: "pantoja-cpe-419",
        courseCode: "CPE 419",
        classYear: "Senior",
        rating: 4,
        text: "Clear lectures, fair grading, and great project feedback. Highly recommend for anyone who wants a hands-on coding course.",
      }),
      review({
        id: "pantoja-cpe-315",
        courseCode: "CPE 315",
        classYear: "Junior",
        rating: 3.8,
        text: "Interactive labs and code reviews made the material feel practical. The professor is approachable and responds quickly to questions.",
      }),
    ],
  },
  {
    id: "zoe-wood",
    name: "Zoë Wood",
    firstName: "Zoë",
    lastName: "Wood",
    department: "CSC",
    courses: ["CSC 307", "CSC 471"],
    starRating: 3.4,
    clarityRating: 3.1,
    supportRating: 3.3,
    reviewCount: 84,
    tags: ["Flexible Deadline Policy", "Recorded Lectures"],
    traits: [],
    weakTraits: ["structured"],
    reviews: [
      review({
        id: "wood-csc-471",
        courseCode: "CSC 471",
        classYear: "Senior",
        rating: 3.5,
        text: "The graphics projects are the best part of the major. Be ready for midterms that carry a large share of the grade.",
      }),
      review({
        id: "wood-csc-307",
        courseCode: "CSC 307",
        classYear: "Junior",
        rating: 3.3,
        text: "Team project work is well structured. The exams are weighted heavily, so do not coast on project scores alone.",
      }),
    ],
  },
  {
    id: "paul-hatalsky",
    name: "Paul Hatalsky",
    firstName: "Paul",
    lastName: "Hatalsky",
    department: "CSC",
    courses: ["CSC 357"],
    starRating: 3.4,
    clarityRating: 3.7,
    supportRating: 3.5,
    reviewCount: 73,
    tags: ["Inflexible Deadline Policy", "Class Handouts"],
    traits: ["structured", "visual-slides"],
    weakTraits: [],
    reviews: [
      review({
        id: "hatalsky-csc-357",
        courseCode: "CSC 357",
        classYear: "Junior",
        rating: 3.4,
        text: "Assignments are graded on working C code against a published spec. Requirements are spelled out precisely.",
      }),
      review({
        id: "hatalsky-csc-357-2",
        courseCode: "CSC 357",
        classYear: "Sophomore",
        rating: 3.3,
        text: "Structured, predictable workload. Start the systems assignments early and you will be fine.",
      }),
    ],
  },
];

const mockCourses: CourseOffering[] = [
  {
    code: "CSC 357",
    title: "Computer Systems",
    department: "CSC",
    term: "Winter '26",
    professorIds: ["paul-hatalsky", "john-clements"],
  },
  {
    code: "CSC 349",
    title: "Design of Algorithms",
    department: "CSC",
    term: "Winter '26",
    professorIds: ["franz-kurfess", "zoe-wood"],
  },
  {
    code: "CSC 307",
    title: "Software Engineering I",
    department: "CSC",
    term: "Winter '26",
    professorIds: ["zoe-wood", "franz-kurfess"],
  },
  {
    code: "CPE 315",
    title: "Computer Architecture",
    department: "CPE",
    term: "Winter '26",
    professorIds: ["maria-pantoja", "john-clements"],
  },
];

export const recentSearches: ReadonlyArray<string> = ["Franz Kurfess", "CPE 315", "CSC 480"];

export const mockProfessorDataService: ProfessorDataService = {
  async getProfessorResults(): Promise<Professor[]> {
    return mockProfessors;
  },
  async getCourseOfferings(): Promise<CourseOffering[]> {
    return mockCourses;
  },
  async getProfessorDetail(id: string): Promise<Professor> {
    const professor = mockProfessors.find((candidate) => candidate.id === id);
    if (!professor) throw new Error(`No demo professor with id ${id}`);
    return professor;
  },
};
