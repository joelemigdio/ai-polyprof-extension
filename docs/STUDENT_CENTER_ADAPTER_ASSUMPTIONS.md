# Student Center Adapter Assumptions

The extension content script is scoped to `https://cmsweb.pscs.calpoly.edu/psc/*`, the PeopleSoft application path. It does not read, store, transmit, or alter Student Center records. The extension also holds host permission for `https://api-prod.polyratings.org/*`, which the background service worker uses to read public professor ratings; nothing from the portal is ever sent there.

## What is verified

The adapter has verified DOM evidence for `span.prof-name[data-name]`, Schedule Builder's `[role="group"][aria-label="Section List"]`, and My Schedule's `[aria-label="Class Schedule"]`. It supports two semantic relationships: a `<dd>` associated with a `<dt>` whose label normalizes to `Instructor` (including nested responsive values such as `<dd><div><span aria-hidden="false">…</span></div></dd>`), and a visible table/grid `Instructor` header associated by column index with that row's instructor cell. It reads `data-name` first, falls back to rendered text, and uses the nearest list item (Schedule Builder) or definition list (My Schedule) as its semantic section container. The fictional fixtures at `public/fixtures/student-center-schedule.html`, `public/fixtures/my-schedule-desktop.html`, and `public/fixtures/my-schedule-responsive.html` mirror these structures. Automated tests cover wrapped names, multiple instructors, repeated names, duplicate prevention, dynamic insertion, name ambiguity, My Schedule main rows, drill-in to professor details, preference-driven re-rendering, and a no-data state.

`groupCandidatesIntoRows` groups detected instructors by their section element, so the hover target is the **class row** rather than each instructor name. Hovering a class therefore lists every professor teaching it. Instructors outside a recognizable section keep their own row instead of being dropped. Grouping consumes the candidates from a single `findInstructorDetection` pass, so detection counts reported to diagnostics and the bound rows always agree.

## Real PolyRatings data on live pages

The content script no longer carries a demo dataset or a `useMockData` switch. It loads the real professor index from `api-prod.polyratings.org` through the background service worker and resolves each detected instructor against it.

Name resolution is in `professor-detection.ts` and handles the formats the portal actually renders: `Kurfess,Franz J`, `Kurfess, Franz`, `Franz Kurfess`, `Dr. Franz Kurfess`, and a bare surname. It compares against PolyRatings' separate `firstName`/`lastName` fields, folds away diacritics and punctuation, and accepts a lone initial for a given name. The safety rule is unchanged: a match is used only when exactly one professor fits. Two different people share a full name in the real data (Chris Clark in CSC and CRP), so a tie resolves to the no-data state rather than guessing.

## Course numbers

`findCourseCode` resolves the course a section belongs to, in priority order: a `[data-polyratings-course-code]` marker, a `<dt>` labelled Course/Class/Subject/Catalog Nbr paired with its value, a heading inside the section, an `aria-label`, and finally a loose scan of the section's text. The loose scan is only trusted when the candidate is a course the catalog actually lists, so section numbers, room numbers, times, and terms cannot be mistaken for a course code. Labels this extension writes itself are skipped so a rescan cannot read back its own output.

Because Cal Poly renumbered every course for Fall 2026, the detected code is expanded through the generated crosswalk before reviews are matched — `CSC 2050` also looks under `CSC 357` and `CPE 357`. A course with no mapping still shows the professor's overall rating.

A tabular schedule now uses the `<tr>` as its section container, so a row's instructor cell and course cell are scoped together.

## What is intentionally not assumed

The adapter intentionally does not depend on generated Material UI class names or scrape generic page text. It uses only verified name selectors and semantic schedule/section-list relationships, so it still needs manual live validation against Student Center updates.

## Evidence needed to enable live verification

Provide one or more authorized, redacted DOM captures from the relevant Student Center course/schedule pages, including:

- a stable course-code field within a section list item;
- a wrapped-name example if the rendered markup differs from the observed `data-name` contract;
- whether sections are rendered in an iframe; and
- any pagination or virtual-list behavior that replaces the Section List.

With that evidence, the `findInstructorCandidates` adapter can be extended with targeted, reviewed selectors. It must retain exact normalized-name matching and the no-data fallback; ambiguous matches must never show another professor's data.

## Hover-card debugging checklist

The content script uses a single Shadow DOM hover card. To debug an authorized live session, open Chrome DevTools on the Student Center tab and confirm:

1. The URL starts with `https://cmsweb.pscs.calpoly.edu/psc/` and the unpacked extension is enabled for that site.
2. `document.querySelectorAll('span.prof-name[data-name]').length` or the semantic Instructor `<dt>`/`<dd>` relationship returns the expected instructors.
3. An identified class row has `data-polyratings-hover-target="true"` and `tabindex="0"` after the page settles.
4. `document.querySelector('#polyratings-hover-host')` exists after the content script loads; inspect its open shadow root for the card.
5. After dynamic navigation or section expansion, wait briefly for the MutationObserver scan, then repeat the checks.

Do not paste student data, authentication tokens, or private schedules into bug reports. Manual verification is still required before claiming live compatibility.
