# Student Center Adapter Assumptions

The extension content script is scoped to `https://cmsweb.pscs.calpoly.edu/psc/*`, the PeopleSoft application path. It requests no access to other websites and does not read, store, transmit, or alter Student Center records.

## What is verified

The content integration is verified only against the fictional fixture at `public/fixtures/student-center-schedule.html`. The fixture explicitly marks course rows, course codes, and instructors with `data-polyratings-*` attributes. The automated tests cover wrapped names, multiple instructors, duplicate prevention, dynamic insertion, name ambiguity, matching demo details, and a no-data state.

## What is intentionally not assumed

No authenticated Student Center HTML, selector, or screenshot was supplied with this milestone. The adapter therefore does not guess at PeopleSoft class names or scrape generic page text in production. On a live page it will wait for a supported adapter selector rather than risk attaching ratings to the wrong person.

## Evidence needed to enable live verification

Provide one or more authorized, redacted DOM captures from the relevant Student Center course/schedule pages, including:

- the course-row container and stable course-code field;
- the instructor field, including a wrapped-name example;
- how dynamically loaded rows are inserted; and
- whether the page is rendered in an iframe or a main document.

With that evidence, the `findInstructorCandidates` adapter can be extended with targeted, reviewed selectors. It must retain exact normalized-name matching and the no-data fallback; ambiguous matches must never show another professor's data.
