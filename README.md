# AI PolyRatings Chrome Extension

Manifest V3 foundation for a Cal Poly Student Center companion extension. The first milestone intentionally implements only the **Professor Results** view using clearly labeled demonstration data. It does not call PolyRatings, scrape Student Center, use real professor ratings, or include API keys.

## Current functionality

- Manifest V3 popup that confirms the extension is running.
- Compact Professor Results cards with name, overall rating, review count, and numerical rating traits.
- A Professor Details view with professor context, numerical trait scores, individual mock reviews, review ratings/tags, and Back navigation.
- Labelled mock data behind an interchangeable `ProfessorDataService` interface.
- A future-ready `chrome.storage.local` preference-storage module; the preferences UI is not part of this milestone.

## Architecture

```
src/
├── models/       # Professor, review, and preference domain types
├── services/     # Data-service interface, mock data, AI boundary, Chrome storage
└── ui/           # React popup and Professor Results components
public/
└── manifest.json # Manifest V3 configuration
```

Future work can add a Student Center content-script adapter, an authorized backend data service, a Professor Details panel, and a Preferences interface without coupling those concerns to the card UI.

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
6. Pin **AI PolyRatings** from Chrome's Extensions menu, then click its icon. You should see “Professor Results” and the “Demo data only” label.
7. After a code change, run `npm run build` again and click the extension's reload icon on `chrome://extensions`.

## Data and security rules

- Do not add API keys, secrets, or private student data to the extension bundle.
- Do not replace mock data with PolyRatings data until the team has an authorized, documented source and has reviewed its terms.
- Keep student preferences in `chrome.storage.local`; add clear/reset controls when the preferences UI is built.
- The AI summary interface is deliberately server-side only; a browser extension must never carry an AI provider secret.

## PolyRatings research and licensing

See [the repository review](docs/POLYRATINGS_REPOSITORY_REVIEW.md). The reference repository is AGPL-3.0. This project is independent and does not copy its code, assets, or data.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Run the Vite UI development server. |
| `npm run build` | Type-check and build a loadable extension into `dist/`. |
| `npm test` | Run the current type-check test gate. |
