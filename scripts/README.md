# scripts/

Build and release helpers. Each script explains itself at the top; this page says which one you
want. Run them from the repository root with Node 22 unless noted.

## Run by CI (keep them working)

| Script | What it does |
|---|---|
| `check-no-licensed-media.mjs` | Fails when the licensed exercise media (Gym visual) is back in the repository or the web image |
| `build-coach-assets.mjs` | `api/coach/core/library-data.js` and `prompts.js`, the Coach's copy of the catalogue and its prompts. `--check` in CI |
| `build-coach-library.mjs` | Old name of the one above, only forwards to it |
| `catalogue/validate.mjs` | Checks every entry in `catalogue/` (fields, words, ids) |
| `catalogue/build.mjs` | Builds the app's exercise files from `catalogue/`. `--check` fails when they are out of date |
| `ci/fork-mr-pipelines.py` | GitLab mirror only: starts pipelines for merge requests from forks |

## Used when you change something

| Script | When |
|---|---|
| `build-hevy-id-map.mjs` | Regenerates `frontend/src/lib/hevy-id-map.js` after Hevy adds templates (needs a Hevy API key) |
| `de-name-rules.mjs` | The German exercise-name rules. `frontend/src/lib/exercise-names.test.js` holds every German name to them |
| `catalogue/migration-check.mjs` | Before a catalogue change ships: compares old and new catalogue on copies of real profiles |

Frontend-only helpers (locale checks, bundle size, the service worker stamp) live in
`frontend/scripts/`, and the API's in `api/scripts/`.

## Kept for the record

One-off scripts from building the v1.4.0 exercise database. Nothing calls them any more; they show
how `catalogue/` was put together.

| Script | What it did |
|---|---|
| `catalogue/import-legacy.mjs` | Wrote `catalogue/` from the exercise data up to v1.3.x |
| `catalogue/import-names.mjs` | Folded the name translations into `catalogue/i18n/` |
