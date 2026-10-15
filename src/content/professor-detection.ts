import type { Professor } from "../models/professor";

/** Normalizes presentation differences only; it does not reorder or shorten names. */
export function normalizeInstructorName(name: string): string {
  return name.replace(/\s+/g, " ").trim().toLocaleLowerCase();
}

/** A match is usable only when exactly one extension professor has the same canonical name. */
export function findConfidentProfessor(instructorName: string, professors: Professor[]): Professor | null {
  const normalizedInstructor = normalizeInstructorName(instructorName);
  if (!normalizedInstructor) return null;
  const matches = professors.filter((professor) => normalizeInstructorName(professor.name) === normalizedInstructor);
  return matches.length === 1 ? matches[0] : null;
}
