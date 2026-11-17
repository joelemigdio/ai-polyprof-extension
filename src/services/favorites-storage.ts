import { favoriteId, sectionFavoriteId, type FavoriteClass } from "../models/favorites";

const storageKey = "favoriteClasses";

export async function loadFavorites(): Promise<FavoriteClass[]> {
  const value = await chrome.storage.local.get(storageKey);
  return normalizeFavorites(value[storageKey]);
}

async function saveFavorites(favorites: FavoriteClass[]): Promise<void> {
  await chrome.storage.local.set({ [storageKey]: favorites });
}

/** Re-saving an existing favorite refreshes its captured ratings rather than duplicating it. */
export async function addFavorite(favorite: FavoriteClass): Promise<FavoriteClass[]> {
  const existing = await loadFavorites();
  const next = [favorite, ...existing.filter((entry) => entry.id !== favorite.id)];
  await saveFavorites(next);
  return next;
}

export async function removeFavorite(id: string): Promise<FavoriteClass[]> {
  const existing = await loadFavorites();
  const next = existing.filter((entry) => entry.id !== id);
  await saveFavorites(next);
  return next;
}

export async function clearFavorites(): Promise<FavoriteClass[]> {
  await saveFavorites([]);
  return [];
}

function optionalString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function optionalRating(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/** Drops malformed entries rather than failing to load the whole list. */
export function normalizeFavorites(value: unknown): FavoriteClass[] {
  if (!Array.isArray(value)) return [];

  const seen = new Set<string>();
  const favorites: FavoriteClass[] = [];

  for (const entry of value) {
    if (!entry || typeof entry !== "object") continue;
    const stored = entry as Partial<FavoriteClass>;
    const courseCode = optionalString(stored.courseCode);
    if (!courseCode) continue;

    const professorId = optionalString(stored.professorId);
    const sectionLabel = optionalString(stored.sectionLabel);
    // Favorites created before sections existed have no kind, and remain
    // course favorites. A malformed section safely falls back to that shape.
    const kind = stored.kind === "section" && sectionLabel ? "section" : "course";
    const id = optionalString(stored.id) ?? (kind === "section"
      ? sectionFavoriteId(courseCode, sectionLabel!)
      : favoriteId(courseCode, professorId));
    if (seen.has(id)) continue;
    seen.add(id);

    favorites.push({
      id,
      kind,
      courseCode,
      courseTitle: optionalString(stored.courseTitle),
      professorId,
      professorName: optionalString(stored.professorName),
      sectionLabel: kind === "section" ? sectionLabel : null,
      classNumber: kind === "section" ? optionalString(stored.classNumber) : null,
      starRating: optionalRating(stored.starRating),
      clarityRating: optionalRating(stored.clarityRating),
      savedAt: optionalString(stored.savedAt) ?? new Date(0).toISOString(),
    });
  }

  return favorites;
}
