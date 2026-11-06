# HanapMeme agent rules

## Ground rules
- Always use the OpenAI developer documentation MCP server (openaiDeveloperDocs) for anything involving the OpenAI API, Codex, or MCP, without being asked. Verify model IDs, request shapes, and parameters there BEFORE writing code. If a model ID isn't available on my key, use the closest available one and note it in the README.
- OPENAI_API_KEY lives only in .env.local and server-side code. Never import it in client components, never prefix it with NEXT_PUBLIC_, never log it, never commit it.
- Every AI call has a timeout and a fallback, so search works with no key.
- Scraped images keep full provenance (source URL, platform, author, retrieval date) and rights_status "unverified". They are never committed to the public repo.
- Never serve images flagged as possibly depicting a minor, a private individual, explicit, or hateful content. Excluded and takedown items never appear in the UI, the API, or MCP.
  - Amendment (2026-11-06, by the maintainer): a link in `sources.yaml` with `approve: true` is served even if the AI review flagged it as `possible_minor` or `private_individual`. Approval never overrides `explicit` or `hateful`, and never restores a takedown. Ingest logs every override.
- Scrape politely: obey robots.txt, max 1 request / 2s per host, identify the bot with a contact URL.
- AI-generated templates depict fictional people only: no real people, no logos.
- The annotator names a real person only from visible text, the source title, or maintainer notes (`subjects`, `context`). It never identifies anyone from their face. A private individual is never named unless a maintainer note names them.
- Work in verified milestones: after each one, run typecheck + build and fix every error before continuing. Don't stop to ask questions; choose sensible defaults and list them in the README.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
