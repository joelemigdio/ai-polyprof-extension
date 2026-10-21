# Student Center Integration Diagnostics

`src/content/development-diagnostics.ts` is a temporary development-only tool. While `ENABLE_DEVELOPMENT_DIAGNOSTICS` is `true`, every matching Student Center frame displays a small fixed bottom-right badge. It contains no instructor names, schedule data, student data, authentication information, or page content.

## Badge stages

- **Script Loaded:** the content script executed in that frame.
- **X Instructor Fields:** the adapter found X semantic `<dt>` fields labeled `Instructor` in that frame.
- **Y Professors Found:** the adapter extracted Y eligible professor targets from verified semantic field relationships and the `span.prof-name[data-name]` contract.
- **Search / Main / Details / Builder:** the badge separately reports targets found in Class Search, My Schedule's visible course rows, My Schedule's expanded definition-list details, and Schedule Builder.
- **Hover Event Received:** a pointer entered a detected instructor target.
- **Hover Card Rendered:** the Shadow DOM card rendered.
- **Rendering Error:** the card render path threw an exception.

## Live debugging steps

1. Build and reload the unpacked extension, then refresh the Student Center tab.
2. Confirm the page URL begins `https://cmsweb.pscs.calpoly.edu/psc/`. Other paths are intentionally outside the manifest match.
3. Look in the lower-right of the top document and any same-origin iframe. `all_frames: true` is enabled for this diagnostic build.
4. If no badge appears, open `chrome://extensions`, inspect **AI PolyRatings**, verify it is enabled, and under **Site access** allow `cmsweb.pscs.calpoly.edu`. Then open the extension's **service worker / content script** errors if Chrome reports one.
5. In DevTools Console, select the relevant frame from the frame dropdown. Search for only `[AI PolyRatings diagnostics]`; these logs do not include page data.
6. If **Search** is zero, inspect only the opening tags of the `Instructor` `<dt>`, its associated `<dd>`, and the name descendant. The verified path accepts a `span[title]` in that `<dd>` and otherwise a nested `[aria-hidden="false"]` element. If **Main** is zero, inspect the visible course listing's container—not course or student data—and copy only the opening tags for its header and one row. The current safe table strategy requires `table`/`role="table"`/`role="grid"`, a `th` or `role="columnheader"` labeled `Instructor`, and same-index `td`, `role="cell"`, or `role="gridcell"` values. If **Details** is zero, compare its Instructor Field count with `[...document.querySelectorAll('[aria-label="Class Schedule"] dt')].filter((el) => el.textContent.trim().toLowerCase().replace(/:$/, '') === 'instructor').length`. A positive field count with zero targets points to an unexpected associated `<dd>` structure. Do not copy schedule content into reports.
7. If a positive count never reaches **Hover Event Received**, inspect an eligible element for `data-polyratings-hover-target="true"` and `tabindex="0"`.
8. If hover is received but no card renders, inspect the badge for **Rendering Error** and report only the stage and non-sensitive console error metadata.

Set `ENABLE_DEVELOPMENT_DIAGNOSTICS` to `false` or remove the module before a release.
