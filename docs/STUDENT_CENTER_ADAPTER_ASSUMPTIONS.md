# Student Center Adapter Assumptions

The extension content script is scoped to `https://cmsweb.pscs.calpoly.edu/psc/*`, the PeopleSoft application path. It requests no access to other websites and does not read, store, transmit, or alter Student Center records.

## What is verified

The adapter has verified DOM evidence for `span.prof-name[data-name]`, Schedule Builder's `[role="group"][aria-label="Section List"]`, and My Schedule's `[aria-label="Class Schedule"]`. It supports two semantic relationships: a `<dd>` associated with a `<dt>` whose label normalizes to `Instructor` (including nested responsive values such as `<dd><div><span aria-hidden="false">…</span></div></dd>`), and a visible table/grid `Instructor` header associated by column index with that row's instructor cell. It reads `data-name` first, falls back to rendered text, and uses the nearest list item (Schedule Builder) or definition list (My Schedule) as its semantic section container. The fictional fixtures at `public/fixtures/student-center-schedule.html`, `public/fixtures/my-schedule-desktop.html`, and `public/fixtures/my-schedule-responsive.html` mirror these structures. Automated tests cover wrapped names, multiple instructors, repeated names, duplicate prevention, dynamic insertion, name ambiguity, matching demo details, and a no-data state.

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
3. An identified name has `data-polyratings-hover-target="true"` and `tabindex="0"` after the page settles.
4. `document.querySelector('#polyratings-hover-host')` exists after the content script loads; inspect its open shadow root for the card.
5. After dynamic navigation or section expansion, wait briefly for the MutationObserver scan, then repeat the checks.

Do not paste student data, authentication tokens, or private schedules into bug reports. Manual verification is still required before claiming live compatibility.
