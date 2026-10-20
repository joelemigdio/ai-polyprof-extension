import type { CourseOffering, Professor } from "../models/professor";
import type { ProfessorDataService } from "./professor-data-service";

/**
 * Demonstration data for the alpha. Ratings, review text, and review counts are
 * invented for UI development and are not real PolyRatings data.
 */
const mockProfessors: Professor[] = [
  {
    id: "franz-kurfess",
    name: "Dr. Franz Kurfess",
    department: "Computer Science",
    courses: ["CSC 480", "CSC 466", "CSC 349"],
    starRating: 4.1,
    peerRating: 4.8,
    reviewCount: 96,
    traits: ["project-heavy", "clear-grading"],
    weakTraits: [],
    reviews: [
      {
        id: "kurfess-csc-480",
        courseCode: "CSC 480",
        classYear: "Senior",
        rating: 4.5,
        text: "The term project drives the whole course and the rubric is published up front, so you always know where you stand.",
      },
      {
        id: "kurfess-csc-466",
        courseCode: "CSC 466",
        classYear: "Junior",
        rating: 4.0,
        text: "Grading criteria are unusually clear. Lectures move quickly, but the assignments reinforce the material well.",
      },
    ],
  },
  {
    id: "john-clements",
    name: "Prof. John Clements",
    department: "Computer Science",
    courses: ["CSC 135", "CSC 430", "CSC 431"],
    starRating: 3.8,
    peerRating: 4.5,
    reviewCount: 112,
    traits: ["visual-slides", "responsive"],
    weakTraits: [],
    reviews: [
      {
        id: "clements-csc-430",
        courseCode: "CSC 430",
        classYear: "Senior",
        rating: 4.0,
        text: "The slides are detailed enough to study from on their own, and questions in lecture get real answers rather than being deferred.",
      },
      {
        id: "clements-csc-135",
        courseCode: "CSC 135",
        classYear: "Sophomore",
        rating: 3.6,
        text: "Very responsive on the course forum. The pace is demanding if you have not seen the material before.",
      },
    ],
  },
  {
    id: "maria-pantoja",
    name: "Dr. Maria Pantoja",
    department: "Computer Engineering",
    courses: ["CPE 315", "CPE 419"],
    starRating: 4.5,
    peerRating: 4.9,
    reviewCount: 128,
    traits: ["code-evaluation", "labs"],
    weakTraits: [],
    reviews: [
      {
        id: "pantoja-cpe-419",
        courseCode: "CPE 419",
        classYear: "Senior",
        rating: 5.0,
        text: "Clear lectures, fair grading, and great project feedback. Highly recommend for anyone who wants a hands-on coding course.",
      },
      {
        id: "pantoja-cpe-315",
        courseCode: "CPE 315",
        classYear: "Junior",
        rating: 4.8,
        text: "Interactive labs and code reviews made the material feel practical. The professor is approachable and responds quickly to questions.",
      },
    ],
  },
  {
    id: "zoe-wood",
    name: "Dr. Zoë Wood",
    department: "Computer Science",
    courses: ["CSC 307", "CSC 471"],
    starRating: 4.3,
    peerRating: 3.9,
    reviewCount: 84,
    traits: ["project-heavy", "labs"],
    weakTraits: ["light-midterms"],
    reviews: [
      {
        id: "wood-csc-471",
        courseCode: "CSC 471",
        classYear: "Senior",
        rating: 4.4,
        text: "The graphics projects are the best part of the major. Be ready for midterms that carry a large share of the grade.",
      },
      {
        id: "wood-csc-307",
        courseCode: "CSC 307",
        classYear: "Junior",
        rating: 4.1,
        text: "Team project work is well structured. The exams are weighted heavily, so do not coast on project scores alone.",
      },
    ],
  },
  {
    id: "paul-hatalsky",
    name: "Paul Hatalsky",
    department: "Computer Science",
    courses: ["CSC 357"],
    starRating: 4.2,
    peerRating: 4.6,
    reviewCount: 73,
    traits: ["code-evaluation", "structured"],
    weakTraits: [],
    reviews: [
      {
        id: "hatalsky-csc-357",
        courseCode: "CSC 357",
        classYear: "Junior",
        rating: 4.3,
        text: "Assignments are graded on working C code against a published spec. Requirements are spelled out precisely.",
      },
      {
        id: "hatalsky-csc-357-2",
        courseCode: "CSC 357",
        classYear: "Sophomore",
        rating: 4.1,
        text: "Structured, predictable workload. Start the systems assignments early and you will be fine.",
      },
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
};
