/**
 * A course or exact Student Center section a student saved while comparing
 * options. Stored locally only; the extension has no account system and
 * writes nothing back to the portal.
 */
export interface FavoriteClass {
  /** Stable key, so re-saving an item is idempotent. */
  id: string;
  /** Missing on pre-section favorites; treat those as course saves. */
  kind?: "course" | "section";
  courseCode: string;
  /** Null when the surface that saved it exposed a code but no verified title. */
  courseTitle: string | null;
  /** Null when the class was saved without an identified professor. */
  professorId: string | null;
  professorName: string | null;
  /**
   * Snapshot of the exact displayed section, such as "S01-LEC (6155)".
   * Null for a course favorite or if Student Center did not expose a section.
   */
  sectionLabel?: string | null;
  /** The PeopleSoft class number captured from the section label, when shown. */
  classNumber?: string | null;
  /** Captured at save time so the favorites list stays comparable offline. */
  starRating: number | null;
  clarityRating: number | null;
  /** ISO timestamp; the list is shown most recently saved first. */
  savedAt: string;
}

export function favoriteId(courseCode: string, professorId: string | null): string {
  return professorId ? `${courseCode}::${professorId}` : courseCode;
}

/** Stable key for one offered section, independent of the ranked professor. */
export function sectionFavoriteId(courseCode: string, sectionLabel: string): string {
  return `${courseCode}::section::${sectionLabel.replace(/\s+/g, " ").trim().toUpperCase()}`;
}
