/**
 * A class a student saved while comparing options. Stored locally only; the
 * extension has no account system and writes nothing back to the portal.
 */
export interface FavoriteClass {
  /** Stable key derived from the course and professor, so re-saving is idempotent. */
  id: string;
  courseCode: string;
  /** Null when the surface that saved it exposed a code but no verified title. */
  courseTitle: string | null;
  /** Null when the class was saved without an identified professor. */
  professorId: string | null;
  professorName: string | null;
  /** Captured at save time so the favorites list stays comparable offline. */
  starRating: number | null;
  clarityRating: number | null;
  /** ISO timestamp; the list is shown most recently saved first. */
  savedAt: string;
}

export function favoriteId(courseCode: string, professorId: string | null): string {
  return professorId ? `${courseCode}::${professorId}` : courseCode;
}
