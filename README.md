# PolyProf Chrome Extension

A Manifest V3 companion extension for Cal Poly students comparing professors during registration. It works on two surfaces: an in-page hover card on the Student Center portal, and a four-screen popup built from the Figma handoff. All ratings are invented demonstration data and are no longer labeled as such in the UI. The extension makes no network requests, does not call PolyRatings, does not read schedule records, and contains no API keys.

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

- Dual ratings: a PolyRatings-style overall score and a separate similar-student score.
- A deterministic matching service (`src/services/preference-matching.ts`) converts saved preferences into match percentages, fit lines, ranking, class summaries, and recommendation copy. Changing a preference visibly changes all of them.

## Not yet implemented

- **No AI model is called.** The `AiSummaryService` interface in `src/services/ai-summary-service.ts` has no implementation. Summaries and fit lines are generated deterministically from a trait vocabulary, not by an LLM, and the UI says so. A real summary needs a server-side endpoint, since a browser extension must never carry a provider key.
- **No real ratings data.** Every rating, review, and count is invented for UI development. Only five professors have demo data.
- **Compare** is rendered per the design but disabled; there is no comparison view.
- **Class time preferences** are stored but unused in matching.
- **Live portal compatibility is unverified** — the adapter is built against documented PeopleSoft structures and a local fixture. See [Student Center adapter assumptions](docs/STUDENT_CENTER_ADAPTER_ASSUMPTIONS.md).

## Architecture

```
src/
├── models/       # Professor, course, review, and preference domain types
├── services/     # Data-service boundary, mock data, preference matching, Chrome storage
├── content/      # Student Center detection, adapter, and hover card
└── ui/           # React popup: four screens plus shared cards, pills, and icons
public/
└── manifest.json # Manifest V3 configuration
```

The `ProfessorDataService` interface is the seam where an authorized backend replaces the demo data without touching the UI.

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
- Do not replace mock data with PolyRatings data until the team has an authorized, documented source and has reviewed its terms.
- Keep student preferences in `chrome.storage.local`.
- The AI summary interface is deliberately server-side only; a browser extension must never carry an AI provider secret.
- **This build shows invented ratings for real instructors on the live portal, with no on-card disclaimer.** The demo-data banners were removed from both the popup and the hover card, so nothing on screen tells a viewer the ratings are fabricated. The only remaining safeguard is exact, unambiguous name matching. Do not distribute to students and do not screenshot it for an audience that may read the ratings as real. Before any student-facing release, wire an authorized data source or set `useMockData` back to `isFixtureDocument(document)` in `src/content/content-script.ts`.

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
