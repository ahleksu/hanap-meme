# Contributing to HanapMeme

## Branches

Create a branch from `main` with one of these prefixes:

- `feat/` for a new feature
- `fix/` for a bug fix
- `chore/` for tooling, docs, and dependencies

Open pull requests into `main` only.

## Commits

Use [Conventional Commits](https://www.conventionalcommits.org/), for example `feat: add GIF filter` or `fix: keep takedowns after re-ingest`.

## Before you open a pull request

1. Run `npm test`.
2. Run `npm run check`. It runs lint, typecheck, and build.
3. Make sure that the app still works with no `OPENAI_API_KEY`.

## Never commit these files

- `.env.local` or any other `.env` file except `.env.example`
- Databases (`*.db`)
- `sources.yaml`
- Scraped images (`data/memes/`, `data/inbox/`, `public/memes/`)

The `.gitignore` file blocks these paths. Do not force-add them.
