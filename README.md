# PolyProf Chrome Extension

A Manifest V3 companion extension for Cal Poly students comparing professors during registration. It works on two surfaces: an in-page hover card on the Student Center portal, and a four-screen popup built from the Figma handoff.

The hover card reads **real PolyRatings data** from the public read-only API at `api-prod.polyratings.org`. The popup still renders invented demonstration data and has not been migrated. The extension reads no schedule records, writes nothing back, and contains no API keys.

## Current functionality

### On the Student Center portal

- Hovering a **class row** shows every professor teaching that section, ranked by fit against your saved preferences, each with both ratings and a fit line.
- A **personalized summary** beneath the professor list compares them and explains the best fit.
- Clicking a professor opens their tags and top reviews in the same card, with a back action.
- Changing a preference in the popup re-renders any open card immediately, with no page reload.
- Instructors with no rating match are listed as "no ratings available yet" rather than hidden.

### In the popup

- **Search** — class search filtered by your saved departments, with recent searches and suggested-class cards showing a preference-driven match percentage.
- **Professor results** — every professor teaching the selected class, ranked, with a pinned AI Recommendation panel explaining the top pick.
- **Professor detail** — ratings alongside top reviews tagged by the reviewer's class year.
- **Preferences** — department, class time, and learning-style multi-selects plus one-tap quick-preference chips, persisted to `chrome.storage.local`.

### Throughout

- Dual ratings per professor, both on PolyRatings' native **0-4 scale**: overall rating and "presents material clearly".
- A deterministic matching service (`src/services/preference-matching.ts`) converts saved preferences into match percentages, fit lines, ranking, class summaries, and recommendation copy. Changing a preference visibly changes all of them.

## Not yet implemented

- **No AI model is called.** The `AiSummaryService` interface in `src/services/ai-summary-service.ts` has no implementation. Summaries and fit lines are generated deterministically from a trait vocabulary, not by an LLM, and the UI says so. A real summary needs a server-side endpoint, since a browser extension must never carry a provider key.
- **The popup still shows demo data.** Only the in-page hover card reads PolyRatings. Migrating the popup needs a UX decision: its search screen browses courses, and real data has ~3,600 of them rather than four.
- **Similar-student ratings do not exist.** The second pill now shows PolyRatings' "presents material clearly" score. A genuine peer rating would need the student's class standing added to preferences, so reviews could be filtered by `gradeLevel`.
- **Five of eight learning-style traits cannot match real data.** PolyRatings tags are logistics ("Uploads Slides", "Recorded Lectures"), not pedagogy. `project-heavy`, `code-evaluation`, `labs`, `clear-grading`, and `light-midterms` have no equivalent, so preference matching fires on only three traits until the vocabulary is migrated.
- **Compare** is rendered per the design but disabled; there is no comparison view.
- **Class time preferences** are stored but unused in matching.
- **Live portal compatibility is unverified** — the adapter is built against documented PeopleSoft structures and a local fixture. See [Student Center adapter assumptions](docs/STUDENT_CENTER_ADAPTER_ASSUMPTIONS.md).

## Architecture

```
src/
├── models/       # Professor, course, review, and preference domain types
├── data/         # Generated quarter->semester course crosswalk and lookup helpers
├── background/   # MV3 service worker: PolyRatings fetching and caching
├── services/     # Data-service boundary, PolyRatings client, preference matching, storage
├── content/      # Student Center detection, adapter, and hover card
└── ui/           # React popup: four screens plus shared cards, pills, and icons
public/
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

- [0.3.0 (alpha)](docs/releases/0.3.0-alpha.md) — all three alpha features on the Poly Portal hover card, plus the four-screen popup.

## PolyRatings research and licensing

See [the repository review](docs/POLYRATINGS_REPOSITORY_REVIEW.md). The reference repository is AGPL-3.0. This project is independent and does not copy its code, assets, or data.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Run the Vite UI development server. |
| `npm run build` | Type-check and build a loadable extension into `dist/`. |
| `npm test` | Run the current type-check test gate. |
