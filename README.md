# PolyProf Chrome Extension

A Manifest V3 companion extension for Cal Poly students comparing professors during registration. It works on two surfaces: an in-page hover card on the Student Center portal, and a popup built from the Figma handoff.

The hover card reads **real PolyRatings data** from the public read-only API at `api-prod.polyratings.org`. The popup still renders invented demonstration data and has not been migrated. The extension reads no schedule records, writes nothing back, and contains no API keys.

## Current functionality

### On the Student Center portal

- Hovering a **class row** shows every professor teaching that section, ranked by fit against your saved preferences, each with both ratings and a fit line.
- A **personalized summary** beneath the professor list compares them and explains the best fit.
- Clicking a professor opens a **review summary** — recurring themes, strengths, and concerns counted from their own reviews — alongside their tags and top reviews, with a back action.
- **Save this class** keeps a class on your favorites list, tagged with whichever professor currently ranks first.
- The course card names a **recommended professor** with the cohort and sample size behind the number, and **Compare Professors** shows every visible instructor's real PolyRatings scores side by side.
- Changing a preference in the popup re-renders any open card immediately, with no page reload.
- Instructors with no rating match are listed as "no ratings available yet" rather than hidden.
- If PolyRatings is unreachable, a dismissible notice says so instead of the page looking as though the extension never ran.

### In the popup

- **Search** — class search filtered by your saved departments, with recent searches and suggested-class cards showing a preference-driven match percentage. Each card has a star to save the class.
- **Professor results** — every professor teaching the selected class, ranked, with a pinned recommendation panel naming the cohort, its rating, the sample size, a confidence badge, and the preferences applied.
- **Compare** — side-by-side bars for overall, presents clearly, and recognizes struggles, with the leader marked per metric.
- **Professor detail** — a review summary (themes, strengths, concerns) above the top reviews, tagged by the reviewer's class year.
- **Favorites** — every saved class in one list with its captured ratings and a one-tap remove, reachable from the star in the header.
- **Preferences** — department, optional class standing, class time, and learning-style multi-selects, a **priority ranking** for the selected styles, one-tap quick-preference chips, and a **Clear all my data** control. Persisted to `chrome.storage.local`.

### Throughout

- Dual ratings per professor, both on PolyRatings' native **0-4 scale**: overall rating and "presents material clearly".
- A deterministic matching service (`src/services/preference-matching.ts`) converts saved preferences into match percentages, fit lines, ranking, class summaries, and recommendation copy. Changing *or reordering* a preference visibly changes all of them.
- Learning styles are **ranked, not just selected**. Their order is the student's priority, and `traitWeights` decays linearly across it — three styles split 50/33/17 — so the top choice outweighs the last.
- A deterministic review synthesizer (`src/services/review-synthesis.ts`) counts valenced phrases in review text to produce themes, strengths, and concerns. See [How the review summary works](#how-the-review-summary-works).
- Every recommendation discloses its cohort, that cohort's rating, the sample size, and the preferences applied. See [How recommendations are explained](#how-recommendations-are-explained).

## How the review summary works

The summary is **counted, not generated**. `synthesizeReviews` scans each review for multi-word cue phrases grouped into ten topics (lecture clarity, workload, grading, helpfulness, exams, organization, pace, projects, attendance, course materials). Each topic carries separate positive and negative cue lists, and a short negation window flips a cue that is negated in context, so "not very helpful" counts against helpfulness rather than for it.

A topic becomes a **theme** once enough distinct reviews mention it — two for a corpus of six or more reviews, one below that. It becomes a **strength** or a **concern** only when one polarity outweighs the other; a topic reviewers disagree on stays listed as a mixed theme with no claim attached. PolyRatings' own tag counts can corroborate a topic the reviews already raised, but never introduce one.

Consequences worth knowing:

- Every sentence it prints is backed by a counted phrase match, so it cannot assert something the reviews do not say. With no corroboration it prints "no topic came up often enough to call it a pattern" rather than inventing one.
- Matching is literal. "Grading criteria are *unusually* clear" does not match the cue `grading criteria are clear`, so real coverage is a floor, not a ceiling.
- Measured against live PolyRatings data for twelve CSC professors with 20+ reviews each: **12/12 produced themes, 10/12 strengths, 8/12 concerns.**

## How recommendations are explained

`buildPeerAggregate` groups a professor's reviews by the reviewer's academic year and walks a fallback ladder: the student's own year, then the years either side, then every reviewer. A tier is only used once it reaches `minimumCohortSize` (3) — below that a mean describes one identifiable student rather than the professor, so the group is widened instead. The tier that produced the number is always reported, so the UI names the group rather than implying a peer match that was not available.

Sample size drives a confidence band (10+ high, 5+ moderate, below that low), and anything short of a well-populated same-year cohort carries a caveat explaining exactly why.

Class standing is **optional and unset by default**. Without it, recommendations use the whole review corpus and say so.

Two honest limits:

- **Same-year only.** PolyRatings stores `gradeLevel` per review but never the reviewer's major, so a same-major cohort cannot be built from this data at all.
- **A professor loaded from the index alone has no review text**, so its overall rating over `numEvals` is reported as the all-reviewers aggregate rather than being mistaken for an unrated professor.

## Not yet implemented

- **No AI model is called.** The `AiSummaryService` interface in `src/services/ai-summary-service.ts` has no implementation. The review summary is phrase counting and the fit lines come from a trait vocabulary; the UI says so on both surfaces. A real LLM summary needs a server-side endpoint, since a browser extension must never carry a provider key.
- **The popup still shows demo data.** Only the in-page hover card reads PolyRatings. Migrating the popup needs a UX decision: its search screen browses courses, and real data has ~3,600 of them rather than four.
- **Peer cohorts are same-year only.** PolyRatings records each reviewer's `gradeLevel` but never their major, so the spec's same-*major* cohort is not buildable from this source. Recommendations say which group they used rather than implying a major match.
- **Five of eight learning-style traits cannot match real data.** PolyRatings tags are logistics ("Uploads Slides", "Recorded Lectures"), not pedagogy. `project-heavy`, `code-evaluation`, `labs`, `clear-grading`, and `light-midterms` have no equivalent, so preference matching fires on only three traits until the vocabulary is migrated.
- **Class time preferences** are stored but unused in matching.
- **Favorites are local only.** They live in `chrome.storage.local`, are not synced, and are keyed by course plus professor.
- **Live portal compatibility is unverified** — the adapter is built against documented PeopleSoft structures and a local fixture. See [Student Center adapter assumptions](docs/STUDENT_CENTER_ADAPTER_ASSUMPTIONS.md).

## Architecture

```
src/
├── models/       # Professor, course, review, favorite, and preference domain types
├── data/         # Generated quarter->semester course crosswalk and lookup helpers
├── background/   # MV3 service worker: PolyRatings fetching and caching
├── services/     # Data-service boundary, PolyRatings client, preference matching,
│                 # review synthesis, preferences and favorites storage
├── content/      # Student Center detection, adapter, hover card, failure notice
└── ui/           # React popup: five screens plus shared cards, pills, and icons
public/
├── icons/        # Generated toolbar icons
└── manifest.json # Manifest V3 configuration
```

The `ProfessorDataService` interface is the seam between the UI and a data source. `polyratingsDataService` implements it against the live API; `mockProfessorDataService` still backs the popup.

### How real data is fetched

Content scripts do not call PolyRatings directly. They message the background service worker, which runs on the extension origin and so is not subject to the Student Center page's `connect-src` policy. The worker caches the 2,473-professor index in `chrome.storage.local` for 24 hours (PolyRatings regenerates nightly) and per-professor reviews in `chrome.storage.session`, and serves a stale index if the API is unreachable.

### Course numbers

Cal Poly renumbered every course for the Fall 2026 semester conversion, so a class on screen reads `CSC 3449` while its reviews are filed under `CSC 349`. The renumbering was not arithmetic — `CSC 357` became `CSC 2050` — and Cal Poly published no crosswalk, so `scripts/build-course-crosswalk.mjs` derives one from the "Formerly"/"Replaced" notes in the semester catalog:

```sh
npm run build:crosswalk          # all 128 departments
node scripts/build-course-crosswalk.mjs csc cpe   # one or more departments
```

The script asserts a set of hand-verified pairs on every run and fails loudly if the catalog's markup or wording changes. It currently yields 3,579 mappings plus 4,356 course titles, covering 88% of CSC reviews posted since 2024. Unmapped courses fall back to the professor's overall rating rather than showing nothing.

## Tests

204 tests across 12 files, run with `npm test` (which type-checks first). `npm run test:coverage` reports **82% line coverage across all of `src/`**.

Coverage is deliberately uneven, and the shape is the point:

- **Decision logic is near-fully covered**, because it is what the product's claims rest on: `review-synthesis` 98%, `recommendation-explanation` 100%, `peer-cohort` 100%, `polyratings-api` 100%, `preference-matching` 94%, `course-professor-comparison` 90%.
- **The content script is covered at 92%**, including the 951-line Student Center adapter at 97%. That adapter is the most brittle code in the project, since it reads markup the project does not control.
- **React screens are covered by render assertions, not interaction tests.** `ComparisonScreen` and `DetailScreen` are at 100%, `ResultsScreen` 86%; `App`, `SearchScreen`, and `PreferencesScreen` are uncovered, so screen wiring and event handlers are verified by hand in a browser rather than by the suite.
- **I/O boundaries are intentionally uncovered**: the MV3 service worker, `content-script.ts` bootstrap, and `polyratings-data-service` are thin adapters over `chrome.*` and `fetch`. The pure logic they call is tested directly instead.

## Prerequisites

- Node.js 20 or newer
- Google Chrome or Chromium-based browser

## Install and build

```bash
npm install
npm run build
```

`npm run dev` starts the Vite development server for popup UI iteration. Chrome loads the built `dist/` directory, so re-run `npm run build` after changes before reloading the extension.

## Load locally in Chrome

1. Run `npm run build` from this project directory.
2. Navigate to `chrome://extensions`.
3. Enable **Developer mode** (top-right).
4. Select **Load unpacked**.
5. Select this project's `dist` directory.
6. Pin **PolyProf** from Chrome's Extensions menu, then click its icon. You should land on the Search screen.
7. After a code change, run `npm run build` again and click the extension's reload icon on `chrome://extensions`.

## Data and security rules

- Do not add API keys, secrets, or private student data to the extension bundle.
- PolyRatings and its data repository are **AGPL-3.0**. `robots.txt` permits crawling outside `/login` and `/admin`, and no policy on third-party API use is stated anywhere in the repo, site, or FAQ — permission is neither granted nor denied. Ask before distributing to students: GitHub issues, `dev@polyratings.dev`, or their Discord.
- Keep student preferences in `chrome.storage.local`.
- The AI summary interface is deliberately server-side only; a browser extension must never carry an AI provider secret.
- **The hover card now shows real reviews written about real professors.** Ratings are no longer invented there, so the earlier fabrication risk is gone, but real review text can be blunt or personal. Name matching still requires an unambiguous match: two different people share a full name in the data (Chris Clark in CSC and CRP), and such a tie deliberately resolves to no match rather than guessing.
- **The popup still shows invented ratings for real faculty names with no on-card disclaimer.** That surface has not been migrated; do not screenshot it for an audience that may read the ratings as real.

## Release notes

Each build handed to testers gets a release note copied from [the release notes template](docs/RELEASE_NOTES_TEMPLATE.md), which includes the install and usage walkthrough testers should follow.

- [0.4.0 (alpha)](docs/releases/0.4.0-alpha.md) — review summaries grounded in review text, favorited classes, and keyboard-reachable hover cards.
- [0.3.0 (alpha)](docs/releases/0.3.0-alpha.md) — all three alpha features on the Poly Portal hover card, plus the four-screen popup.

## PolyRatings research and licensing

See [the repository review](docs/POLYRATINGS_REPOSITORY_REVIEW.md). The reference repository is AGPL-3.0. This project is independent and does not copy its code, assets, or data.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Run the Vite UI development server. |
| `npm run build` | Type-check and build a loadable extension into `dist/`. |
| `npm run package` | Build, then zip `dist/` into `polyprof-<version>.zip` for handoff. |
| `npm run build:icons` | Regenerate the toolbar icons in `public/icons`. |
| `npm run build:crosswalk` | Rebuild the quarter-to-semester course crosswalk from the catalog. |
| `npm test` | Type-check, then run the test suite. |
| `npm run test:coverage` | Run the suite with line/branch coverage across all of `src/`. |
