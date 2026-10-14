# PolyRatings Repository Review

Reviewed repository: <https://github.com/Polyratings/polyratings> (public repository, reviewed 2026-10-14).

## What the repository contains

PolyRatings is a Lerna monorepo with a React/TypeScript frontend, a TypeScript backend deployed as Cloudflare Workers, and a cron package for nightly synchronization/backup. The frontend uses Vite, React, TypeScript, tRPC, and reusable components such as `ProfessorCard`. The backend has tRPC routers for professors and ratings and Zod validation schemas.

## Data model observations

- A professor has a UUID, first/last name, department, aggregate rating fields, courses, tags, and review groups keyed by course.
- A rating/review has a UUID, professor ID, grade/course information, numeric scores, review text, tags, and a post date.
- The backend explicitly separates a public review/professor schema from fields such as an anonymous identifier. This is a useful privacy pattern.
- Existing named numeric fields include overall rating, material clarity, and recognition of student difficulties. The alpha extension uses its own generic trait model so it can support the course requirements without copying their model.

## API assessment

The repository source defines public tRPC procedures including professor listing (`professors.all`) and professor lookup (`professors.get`), but this does **not** establish an approved, stable public API for this extension. No documented third-party API agreement or extension-use authorization was verified. The alpha project therefore does not make calls to PolyRatings or use real PolyRatings data. Its `ProfessorDataService` is an interchangeable seam currently fulfilled only by labelled mock data.

## What can be reused safely as ideas

- TypeScript domain models and runtime validation at an eventual backend boundary.
- A compact card pattern: name, department, rating, and evaluation count.
- Public/private data separation and anonymous-review safeguards.
- A separate data-access layer rather than having UI components directly fetch data.

This project does not copy source code, assets, data, or API clients from PolyRatings.

## License

The repository's `LICENSE` is GNU Affero General Public License v3.0 (AGPL-3.0). Copying or adapting covered code would require complying with AGPL obligations, including preserving notices and making corresponding source available to users who interact with a modified network service. Consult the full license and course/institution guidance before incorporating any repository code. An independent implementation that does not copy covered expression avoids making this alpha a derivative work, but this is not legal advice.
