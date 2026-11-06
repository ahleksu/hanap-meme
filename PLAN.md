# HanapMeme plan

1. Scaffold Next.js 16 (App Router, TS, Tailwind) with better-sqlite3, openai, zod, MCP SDK, @napi-rs/canvas.
2. `lib/db.ts`: one `memes` table plus a `reports` table. Only `status = 'active'` rows leave the server.
3. `scripts/ingest.ts`: inbox folder, polite page scraper (robots.txt, 1 req / 2s / host), Imgflip API. sha256 dedupe, WebP 1024px, annotate, embed, upsert, export catalog.json.
4. `lib/search.ts`: embeddings + cosine top 30 + optional rerank (3s), BM25 keyword fallback with a Taglish synonym map.
5. REST routes: `/api/search`, `/api/memes/:id`, `/api/memes/:id/image`, `/api/report`, `/api/generate`. Rate limit per IP, CORS on GET.
6. Web UI: search page with masonry grid, cards, detail modal, report toast, `/generate`, `/about`, `/takedown`.
7. MCP server at `/api/mcp` (stateless Streamable HTTP): `search_memes`, `get_meme`, `generate_meme`.
8. `scripts/generate-templates.ts` and `lib/generate.ts`: AI template backgrounds and caption rendering with Anton.
9. Docs, license files, GitHub templates, devcontainer, CI with no key.
10. Verify each milestone with typecheck + build, then scan for secrets and publish the public repo.
