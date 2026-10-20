# Release notes template

Copy this file to `docs/releases/<version>.md` for each build handed to testers. Replace every `<placeholder>`. Delete sections that do not apply rather than leaving them empty.

---

# AI PolyRatings <version> (<alpha | beta | release>)

**Released:** <YYYY-MM-DD>
**Supported page:** <e.g. Cal Poly Student Center schedule / class search>
**Data source:** <demonstration data | authorized ratings source>

## Summary

<One or two sentences on what a student can now do that they could not do in the previous build.>

## What's new

- <Feature name> — <what the student sees and where they see it.>
- <Feature name> — <what the student sees and where they see it.>

## Changed

- <Behavior that existed before and now works differently.>

## Fixed

- <Bug, and the symptom a tester would have noticed.>

## How to use the extension

### Install the build

1. Run `npm install` once, then `npm run build`. The loadable extension is written to `dist/`.
2. Open `chrome://extensions` in Chrome.
3. Turn on **Developer mode** (top-right).
4. Click **Load unpacked** and select this project's `dist` directory.
5. Open Chrome's Extensions menu and pin **AI PolyRatings** so the icon stays visible.
6. After pulling new code, re-run `npm run build` and click the reload icon on the extension's card in `chrome://extensions`.

### Set your preferences first

1. Click the **AI PolyRatings** icon to open the popup.
2. Open **Preferences**.
3. For each characteristic (<e.g. workload, clarity, attendance strictness>), set how much it matters to you and which direction you prefer.
4. Preferences save to your browser only (`chrome.storage.local`) and are used to personalize summaries and ordering. Use **<clear/reset control name>** to erase them.

### See professors for a class

1. Go to <supported page URL or navigation path>.
2. Hover over a class row.
3. A card lists every professor teaching that class, each with an overall rating and review count.
4. If no match is found, the card says so instead of showing an empty state — report those cases.

### Read the personalized AI summary

1. With the class card open, scroll beneath the professor list.
2. The AI summary reflects the preferences you set. Change a preference and re-hover to see it update.
3. Summaries are generated from available reviews only. <State whether this build uses demonstration data or a live source.>

### Open a professor's detail view

1. Click a professor's name on the class card.
2. The detail view shows their overall rating, rating breakdown, review tags, and individual reviews.
3. Use **Back** to return to the class card.

## Known limitations

- <Limitation a tester will hit, and what to do instead.>
- <Data accuracy or coverage caveat.>

## Data and privacy

- Preferences stay in `chrome.storage.local` on this browser; nothing is synced to an account.
- No API keys or secrets ship in the extension bundle.
- <State the ratings data source and its authorization status for this build.>

## How to report problems

<Where to file issues, and what to include: page URL, class and professor, screenshot, what you expected.>
