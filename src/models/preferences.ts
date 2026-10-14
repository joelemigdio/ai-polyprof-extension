import type { RatingTraitName } from "./professor";

export interface StudentPreferences {
  prioritizedTraits: RatingTraitName[];
}

export const defaultStudentPreferences: StudentPreferences = {
  prioritizedTraits: [],
};
