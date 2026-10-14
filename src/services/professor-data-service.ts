import type { Professor } from "../models/professor";

/**
 * Boundary for professor data. Replace the mock implementation only after an
 * authorized, documented data source has been approved by the team.
 */
export interface ProfessorDataService {
  getProfessorResults(): Promise<Professor[]>;
}
