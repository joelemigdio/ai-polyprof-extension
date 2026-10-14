import type { Professor } from "../models/professor";
import type { ProfessorDataService } from "./professor-data-service";

const mockProfessors: Professor[] = [
  {
    id: "demo-ada-lovelace",
    name: "Dr. Ada Lovelace",
    department: "Computer Science",
    overallRating: 4.6,
    reviewCount: 3,
    ratingTraits: [
      { name: "Teaching quality", score: 4.8 },
      { name: "Clarity", score: 4.7 },
      { name: "Workload", score: 3.8 },
      { name: "Difficulty", score: 3.6 },
      { name: "Attendance", score: 3.1 },
      { name: "Flexibility", score: 4.2 },
    ],
    reviews: [
      {
        id: "demo-ada-csc-307",
        courseCode: "CSC 307",
        submittedAt: "2026-09-20",
        rating: 5,
        text: "Clear lectures and thoughtful feedback. The projects took time, but the expectations were explained well.",
        tags: ["Clear lectures", "Helpful feedback"],
      },
      {
        id: "demo-ada-csc-430",
        courseCode: "CSC 430",
        submittedAt: "2026-08-18",
        rating: 4,
        text: "Clear explanations made the challenging projects manageable. The workload is substantial, but office hours are helpful.",
        tags: ["Clear lectures", "Challenging workload"],
      },
      {
        id: "demo-ada-csc-365",
        courseCode: "CSC 365",
        submittedAt: "2026-06-04",
        rating: 4,
        text: "Helpful feedback on assignments and a challenging workload. I understood the material better after asking questions.",
        tags: ["Helpful feedback", "Challenging workload"],
      },
    ],
  },
  {
    id: "demo-grace-hopper",
    name: "Dr. Grace Hopper",
    department: "Computer Science",
    overallRating: 4.3,
    reviewCount: 4,
    ratingTraits: [
      { name: "Teaching quality", score: 4.4 },
      { name: "Clarity", score: 4.1 },
      { name: "Workload", score: 3.4 },
      { name: "Difficulty", score: 3.2 },
      { name: "Attendance", score: 2.4 },
      { name: "Flexibility", score: 4.6 },
    ],
    reviews: [
      {
        id: "demo-grace-csc-349",
        courseCode: "CSC 349",
        submittedAt: "2026-09-12",
        rating: 4,
        text: "Very approachable instructor and flexible when students communicate early. Exams require careful preparation.",
        tags: ["Approachable", "Flexible grading"],
      },
      {
        id: "demo-grace-csc-357",
        courseCode: "CSC 357",
        submittedAt: "2026-07-29",
        rating: 5,
        text: "The practical examples were useful, though exams require careful preparation.",
        tags: ["Practical examples", "Exam preparation required"],
      },
      {
        id: "demo-grace-csc-430",
        courseCode: "CSC 430",
        submittedAt: "2026-06-30",
        rating: 4,
        text: "Approachable in office hours and flexible grading when concerns were raised early.",
        tags: ["Approachable", "Flexible grading"],
      },
      {
        id: "demo-grace-csc-203",
        courseCode: "CSC 203",
        submittedAt: "2026-05-16",
        rating: 4,
        text: "Practical examples helped, but I needed to prepare carefully for the exams.",
        tags: ["Practical examples", "Exam preparation required"],
      },
    ],
  },
];

export const mockProfessorDataService: ProfessorDataService = {
  async getProfessorResults(): Promise<Professor[]> {
    return mockProfessors;
  },
};
