import type { Professor } from "../models/professor";
import type { ProfessorDataService } from "./professor-data-service";

const mockProfessors: Professor[] = [
  {
    id: "demo-ada-lovelace",
    name: "Dr. Ada Lovelace",
    department: "Computer Science",
    overallRating: 4.6,
    reviewCount: 24,
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
        text: "Challenging material with a fair workload. Going to office hours made a big difference.",
        tags: ["Challenging", "Fair grading"],
      },
    ],
  },
  {
    id: "demo-grace-hopper",
    name: "Dr. Grace Hopper",
    department: "Computer Science",
    overallRating: 4.3,
    reviewCount: 18,
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
        tags: ["Approachable", "Flexible"],
      },
      {
        id: "demo-grace-csc-357",
        courseCode: "CSC 357",
        submittedAt: "2026-07-29",
        rating: 5,
        text: "The examples were practical and the class moved at a manageable pace. Attendance was encouraged but not stressful.",
        tags: ["Practical examples", "Manageable pace"],
      },
    ],
  },
];

export const mockProfessorDataService: ProfessorDataService = {
  async getProfessorResults(): Promise<Professor[]> {
    return mockProfessors;
  },
};
