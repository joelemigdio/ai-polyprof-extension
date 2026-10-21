import type { Professor, ProfessorReview } from "../models/professor";
import type { TraitKey } from "../models/preferences";

/**
 * Read-only client types for the public PolyRatings tRPC API. The backend mounts
 * tRPC at the origin root with batching disabled, so a query is a plain GET of
 * `/<router>.<procedure>` with a JSON `input` query parameter.
 *
 * Reads are unauthenticated and are not rate limited (only submission mutations
 * are). Every response carries `Access-Control-Allow-Origin: *`.
 */
export const polyratingsApiOrigin = "https://api-prod.polyratings.org";

export const professorIndexUrl = `${polyratingsApiOrigin}/professors.all`;

export function professorDetailUrl(id: string): string {
  return `${polyratingsApiOrigin}/professors.get?input=${encodeURIComponent(JSON.stringify({ id }))}`;
}

interface TrpcResponse<T> {
  result?: { data?: T };
  error?: { message?: string };
}

export interface RawTruncatedProfessor {
  id: string;
  department: string;
  firstName: string;
  lastName: string;
  numEvals: number;
  overallRating: number;
  materialClear: number;
  studentDifficulties: number;
  courses: string[];
  tags?: Record<string, number>;
  lastRatingDate?: string;
}

export interface RawRating {
  id: string;
  grade: string;
  gradeLevel: string;
  courseType: string;
  overallRating: number;
  presentsMaterialClearly: number;
  recognizesStudentDifficulties: number;
  rating: string;
  postDate: string;
}

export interface RawProfessor extends RawTruncatedProfessor {
  reviews: Record<string, RawRating[]>;
}

/**
 * Content scripts reach PolyRatings through the background worker rather than
 * calling it directly: the worker runs on the extension origin, so it is not
 * subject to the Student Center page's connect-src policy.
 */
export type PolyratingsRequest = { type: "professorIndex" } | { type: "professorDetail"; id: string };

export type PolyratingsReply<T> = { ok: true; data: T } | { ok: false; error: string };

export function unwrapTrpc<T>(body: unknown): T {
  const response = body as TrpcResponse<T>;
  if (response.error) throw new Error(response.error.message ?? "PolyRatings request failed");
  if (response.result?.data === undefined) throw new Error("PolyRatings response had no data");
  return response.result.data;
}

/**
 * How PolyRatings' fixed tag vocabulary maps onto the extension's learning-style
 * traits. Only tags with a genuine correspondence are listed; the rest are shown
 * to students verbatim instead of being forced into a trait.
 *
 * Five traits have no PolyRatings equivalent at all (project-heavy,
 * code-evaluation, labs, clear-grading, light-midterms), so preference matching
 * on those cannot fire against real data.
 */
const tagTraits: Record<string, { trait: TraitKey; weak: boolean }> = {
  "Uploads Slides": { trait: "visual-slides", weak: false },
  "Class Handouts": { trait: "visual-slides", weak: false },
  "Fast Response Time": { trait: "responsive", weak: false },
  "High In-Person Availability": { trait: "responsive", weak: false },
  "Inflexible Deadline Policy": { trait: "structured", weak: false },
  "Flexible Deadline Policy": { trait: "structured", weak: true },
  "Does Not Use Canvas": { trait: "structured", weak: true },
};

/** A single reviewer citing a tag is noise; require corroboration. */
const minimumTagCitations = 2;

function sortedTags(tags: Record<string, number> | undefined): string[] {
  return Object.entries(tags ?? {})
    .sort(([leftName, leftCount], [rightName, rightCount]) => rightCount - leftCount || leftName.localeCompare(rightName))
    .map(([name]) => name);
}

function deriveTraits(tags: Record<string, number> | undefined): { traits: TraitKey[]; weakTraits: TraitKey[] } {
  const traits = new Set<TraitKey>();
  const weakTraits = new Set<TraitKey>();
  for (const [name, count] of Object.entries(tags ?? {})) {
    const mapping = tagTraits[name];
    if (!mapping || count < minimumTagCitations) continue;
    (mapping.weak ? weakTraits : traits).add(mapping.trait);
  }
  // A trait reported both ways is contradictory; trust neither.
  for (const trait of traits) if (weakTraits.has(trait)) weakTraits.delete(trait);
  return { traits: [...traits], weakTraits: [...weakTraits] };
}

function toReviews(reviews: Record<string, RawRating[]>): ProfessorReview[] {
  return Object.entries(reviews)
    .flatMap(([courseCode, ratings]) =>
      ratings.map((rating) => ({
        id: rating.id,
        courseCode,
        classYear: rating.gradeLevel,
        rating: rating.overallRating,
        text: rating.rating,
        grade: rating.grade,
        courseType: rating.courseType,
        postDate: rating.postDate,
      })),
    )
    .sort((left, right) => Date.parse(right.postDate) - Date.parse(left.postDate));
}

export function toProfessor(raw: RawTruncatedProfessor | RawProfessor): Professor {
  const { traits, weakTraits } = deriveTraits(raw.tags);
  return {
    id: raw.id,
    name: `${raw.firstName} ${raw.lastName}`.replace(/\s+/g, " ").trim(),
    firstName: raw.firstName,
    lastName: raw.lastName,
    department: raw.department,
    courses: raw.courses,
    starRating: raw.overallRating,
    clarityRating: raw.materialClear,
    supportRating: raw.studentDifficulties,
    reviewCount: raw.numEvals,
    tags: sortedTags(raw.tags),
    traits,
    weakTraits,
    reviews: "reviews" in raw ? toReviews(raw.reviews) : [],
  };
}
