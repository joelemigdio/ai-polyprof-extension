import {
  professorDetailUrl,
  professorIndexUrl,
  unwrapTrpc,
  type PolyratingsReply,
  type PolyratingsRequest,
  type RawProfessor,
  type RawTruncatedProfessor,
} from "../services/polyratings-api";

/** PolyRatings regenerates its data nightly, so a day-old index is still current. */
const indexTtlMs = 24 * 60 * 60 * 1000;
const indexKey = "polyratingsIndex";

interface CachedIndex {
  fetchedAt: number;
  professors: RawTruncatedProfessor[];
}

async function fetchJson(url: string): Promise<unknown> {
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`PolyRatings responded ${response.status}`);
  return response.json();
}

async function loadIndex(): Promise<RawTruncatedProfessor[]> {
  const cached = (await chrome.storage.local.get(indexKey))[indexKey] as CachedIndex | undefined;
  if (cached && Date.now() - cached.fetchedAt < indexTtlMs) return cached.professors;

  try {
    const professors = unwrapTrpc<RawTruncatedProfessor[]>(await fetchJson(professorIndexUrl));
    await chrome.storage.local.set({ [indexKey]: { fetchedAt: Date.now(), professors } satisfies CachedIndex });
    return professors;
  } catch (error) {
    // A stale index beats no ratings at all when the network or API is down.
    if (cached) return cached.professors;
    throw error;
  }
}

/**
 * Reviews are cached in session storage rather than local storage so the cache
 * cannot grow without bound across days; the index is the only persisted copy.
 */
async function loadDetail(id: string): Promise<RawProfessor> {
  const key = `polyratingsProfessor:${id}`;
  const cached = (await chrome.storage.session.get(key))[key] as RawProfessor | undefined;
  if (cached) return cached;

  const professor = unwrapTrpc<RawProfessor>(await fetchJson(professorDetailUrl(id)));
  await chrome.storage.session.set({ [key]: professor });
  return professor;
}

async function handle(request: PolyratingsRequest): Promise<unknown> {
  if (request.type === "professorIndex") return loadIndex();
  return loadDetail(request.id);
}

chrome.runtime.onMessage.addListener((request: PolyratingsRequest, _sender, sendResponse) => {
  handle(request)
    .then((data) => sendResponse({ ok: true, data } satisfies PolyratingsReply<unknown>))
    .catch((error: unknown) =>
      sendResponse({ ok: false, error: error instanceof Error ? error.message : String(error) } satisfies PolyratingsReply<unknown>),
    );
  // Keeps the message channel open for the async response above.
  return true;
});
