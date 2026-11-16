import { beforeEach, describe, expect, it } from "vitest";
import { favoriteId, type FavoriteClass } from "../models/favorites";
import { addFavorite, clearFavorites, loadFavorites, normalizeFavorites, removeFavorite } from "./favorites-storage";

function fakeStorage(): Record<string, unknown> {
  const store: Record<string, unknown> = {};
  (globalThis as { chrome?: unknown }).chrome = {
    storage: {
      local: {
        get: async (key: string) => ({ [key]: store[key] }),
        set: async (values: Record<string, unknown>) => void Object.assign(store, values),
      },
    },
  };
  return store;
}

function favorite(overrides: Partial<FavoriteClass> = {}): FavoriteClass {
  return {
    id: favoriteId("CSC 3100", "ada"),
    courseCode: "CSC 3100",
    courseTitle: "Software Engineering",
    professorId: "ada",
    professorName: "Ada Lovelace",
    starRating: 3.6,
    clarityRating: 3.4,
    savedAt: "2026-11-16T00:00:00.000Z",
    ...overrides,
  };
}

describe("favorites storage", () => {
  beforeEach(() => {
    fakeStorage();
  });

  it("starts empty", async () => {
    expect(await loadFavorites()).toEqual([]);
  });

  it("saves and reloads a favorite", async () => {
    await addFavorite(favorite());
    const loaded = await loadFavorites();

    expect(loaded).toHaveLength(1);
    expect(loaded[0].courseCode).toBe("CSC 3100");
  });

  it("puts the most recently saved class first", async () => {
    await addFavorite(favorite());
    await addFavorite(favorite({ id: favoriteId("CSC 2050", "grace"), courseCode: "CSC 2050", professorId: "grace" }));

    expect((await loadFavorites()).map((entry) => entry.courseCode)).toEqual(["CSC 2050", "CSC 3100"]);
  });

  it("refreshes rather than duplicates when the same class is saved twice", async () => {
    await addFavorite(favorite({ starRating: 3.6 }));
    await addFavorite(favorite({ starRating: 3.9 }));
    const loaded = await loadFavorites();

    expect(loaded).toHaveLength(1);
    expect(loaded[0].starRating).toBe(3.9);
  });

  it("removes only the requested favorite", async () => {
    await addFavorite(favorite());
    await addFavorite(favorite({ id: favoriteId("CSC 2050", "grace"), courseCode: "CSC 2050", professorId: "grace" }));
    await removeFavorite(favoriteId("CSC 3100", "ada"));

    expect((await loadFavorites()).map((entry) => entry.courseCode)).toEqual(["CSC 2050"]);
  });

  it("clears every favorite", async () => {
    await addFavorite(favorite());
    await clearFavorites();

    expect(await loadFavorites()).toEqual([]);
  });

  it("treats the same course under different professors as separate saves", async () => {
    await addFavorite(favorite());
    await addFavorite(favorite({ id: favoriteId("CSC 3100", "grace"), professorId: "grace", professorName: "Grace Hopper" }));

    expect(await loadFavorites()).toHaveLength(2);
  });
});

describe("normalizeFavorites", () => {
  it("returns an empty list for anything that is not an array", () => {
    expect(normalizeFavorites(undefined)).toEqual([]);
    expect(normalizeFavorites(null)).toEqual([]);
    expect(normalizeFavorites("CSC 3100")).toEqual([]);
    expect(normalizeFavorites({ courseCode: "CSC 3100" })).toEqual([]);
  });

  it("drops entries with no course code rather than failing the whole list", () => {
    const result = normalizeFavorites([{ id: "broken" }, favorite(), null, 7]);

    expect(result).toHaveLength(1);
    expect(result[0].courseCode).toBe("CSC 3100");
  });

  it("rebuilds a missing id from the course and professor", () => {
    const result = normalizeFavorites([{ courseCode: "CSC 3100", professorId: "ada" }]);

    expect(result[0].id).toBe(favoriteId("CSC 3100", "ada"));
  });

  it("coerces malformed ratings to null instead of NaN", () => {
    const result = normalizeFavorites([{ courseCode: "CSC 3100", starRating: "high", clarityRating: Number.NaN }]);

    expect(result[0].starRating).toBeNull();
    expect(result[0].clarityRating).toBeNull();
  });

  it("de-duplicates repeated ids", () => {
    const result = normalizeFavorites([favorite(), favorite()]);

    expect(result).toHaveLength(1);
  });
});
