import type { CourseOffering, Professor } from "../models/professor";

/**
 * Boundary for professor data. `getProfessorResults` returns the index, which
 * carries ratings but no review text; `getProfessorDetail` fetches one
 * professor's reviews on demand.
 */
export interface ProfessorDataService {
  getProfessorResults(): Promise<Professor[]>;
  getCourseOfferings(): Promise<CourseOffering[]>;
  getProfessorDetail(id: string): Promise<Professor>;
}
