import type { Professor } from "../models/professor";

/** Normalizes presentation differences only; it does not reorder or shorten names. */
export function normalizeInstructorName(name: string): string {
  return name.replace(/\s+/g, " ").trim().toLocaleLowerCase();
}

/**
 * Collapses a name part to comparable letters: strips diacritics, punctuation,
 * and spacing, so "Zoë" matches "Zoe" and "Van Dyke" matches "VanDyke".
 */
function fold(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/gu, "")
    .toLowerCase()
    .replace(/[^a-z]/g, "");
}

const honorifics = new Set(["dr", "prof", "professor", "mr", "mrs", "ms", "mx"]);
const suffixes = new Set(["jr", "sr", "ii", "iii", "iv", "phd"]);

export interface ParsedInstructorName {
  first: string;
  last: string;
}

/**
 * Parses the instructor strings the portal actually renders: PeopleSoft writes
 * "Kurfess,Franz J", while other surfaces render "Franz Kurfess". A surname with
 * no given name is valid and resolves only when the surname is unique.
 */
export function parseInstructorName(raw: string): ParsedInstructorName | null {
  const cleaned = raw.replace(/\s+/g, " ").trim();
  if (!cleaned) return null;

  if (cleaned.includes(",")) {
    const [lastPart, firstPart = ""] = cleaned.split(",");
    const last = lastPart.trim();
    const first = firstPart.trim().split(" ").find((token) => !suffixes.has(fold(token))) ?? "";
    return last ? { first, last } : null;
  }

  const tokens = cleaned
    .split(" ")
    .filter((token) => fold(token) && !honorifics.has(fold(token).replace(/\.$/, "")) && !suffixes.has(fold(token)));
  if (tokens.length === 0) return null;
  if (tokens.length === 1) return { first: "", last: tokens[0] };
  return { first: tokens[0], last: tokens.at(-1) as string };
}

/** Treats a lone initial as matching any given name starting with that letter. */
function givenNamesAgree(parsed: string, candidate: string): boolean {
  const left = fold(parsed);
  const right = fold(candidate);
  if (!left || !right) return true;
  if (left === right) return true;
  if (left.length === 1) return right.startsWith(left);
  if (right.length === 1) return left.startsWith(right);
  return false;
}

/**
 * A match is usable only when exactly one professor fits, so an ambiguous
 * surname shows the no-data state rather than another professor's ratings.
 */
export function findConfidentProfessor(instructorName: string, professors: Professor[]): Professor | null {
  const parsed = parseInstructorName(instructorName);
  if (!parsed) return null;

  const surnameMatches = professors.filter((professor) => fold(professor.lastName) === fold(parsed.last));
  if (surnameMatches.length === 0) return null;
  if (surnameMatches.length === 1 && !parsed.first) return surnameMatches[0];

  // Identical names in the real data belong to different people in different
  // departments rather than being duplicate records, so a tie must never
  // resolve to one of them.
  const fullMatches = surnameMatches.filter((professor) => givenNamesAgree(parsed.first, professor.firstName));
  return fullMatches.length === 1 ? fullMatches[0] : null;
}
