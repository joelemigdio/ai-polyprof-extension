# Student Center Adapter Assumptions

The extension content script is scoped to `https://cmsweb.pscs.calpoly.edu/psc/*`, the PeopleSoft application path. It requests no access to other websites and does not read, store, transmit, or alter Student Center records.

## What is verified

The adapter has verified DOM evidence for `span.prof-name[data-name]`, Schedule Builder's responsive `[role="group"][aria-label="Section List"]` and desktop `[role="table"][aria-label="Sections List"]`, My Schedule's responsive definition-list details and desktop `[aria-label="Class Schedule"][role="treegrid"]`, and Class Search's semantic Instructor field. It supports five semantic relationships: a `<dd>` associated with a `<dt>` whose label normalizes to `Instructor` (including nested responsive values such as `<dd><div><span aria-hidden="false">…</span></div></dd>`), a My Schedule desktop treegrid `role="gridcell"` whose `header` is `Instructor` in a `data-row-id` course row, a Class Search Instructor `<dd>` containing a `span[title]` or visible nested fallback, a Class Search desktop table with an exact `…-INSTRUCTOR` column-header id and matching `…_INSTRUCTOR` data-cell id, and a Schedule Builder desktop table that follows the Instructor header's nested structural path into each data row. The Class Search desktop path skips nested detail rows and binds to the visible descendant inside the Instructor cell; it does not use column position because the live table includes an unmatched expand/control cell. The Schedule Builder desktop path likewise avoids flat cell positions because its header and data rows use nested grid groups. The My Schedule treegrid path requires both a verified Instructor column header and an Instructor-labeled grid cell, rather than relying on generated Material UI classes. It reads `data-name` or the Class Search `title` first, then falls back to rendered text. The fictional fixtures at `public/fixtures/student-center-schedule.html`, `public/fixtures/schedule-builder-desktop.html`, `public/fixtures/class-search-results.html`, `public/fixtures/class-search-desktop.html`, `public/fixtures/my-schedule-desktop.html`, and `public/fixtures/my-schedule-responsive.html` mirror these structures. Automated tests cover wrapped names, multiple instructors, repeated names, duplicate prevention, dynamic insertion, name ambiguity, Class Search, My Schedule main rows, drill-in to professor details, preference-driven re-rendering, and a no-data state.

`groupCandidatesIntoRows` groups detected instructors by their section for card content, but creates one hover target for each visible instructor value. This keeps the interaction limited to the instructor name while allowing a shared card to list every professor teaching that course. Instructors outside a recognizable section keep their own card grouping instead of being dropped. Grouping consumes the candidates from a single `findInstructorDetection` pass, so detection counts reported to diagnostics and the bound targets always agree.

## Demo data on live pages

The content script restricts demo ratings to pages marked as a local fixture. Real Student Center instructors always use the no-data path until an authorized PolyRatings data source is available. Exact normalized matching remains in place for fixture demonstrations and prevents ambiguous names from being associated with another professor.

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
3. An identified instructor value—not its enclosing course row—has `data-polyratings-hover-target="true"` and `tabindex="0"` after the page settles.
4. `document.querySelector('#polyratings-hover-host')` exists after the content script loads; inspect its open shadow root for the card.
5. After dynamic navigation or section expansion, wait briefly for the MutationObserver scan, then repeat the checks.

Do not paste student data, authentication tokens, or private schedules into bug reports. Manual verification is still required before claiming live compatibility.
