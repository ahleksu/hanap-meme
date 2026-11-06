import { list, put } from "@vercel/blob";

// On Vercel the bundled SQLite file is read-only and resets on every cold start, so takedowns
// also go to a private Vercel Blob store. Locally, with no Blob env vars, SQLite alone is enough.
export const blobEnabled = () => !!(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID);

const PREFIX = "takedowns/";
let cache: { ids: Set<string>; at: number } | null = null;

export async function takedownIds(): Promise<Set<string>> {
  if (!blobEnabled()) return new Set();
  if (cache && Date.now() - cache.at < 5_000) return cache.ids;
  const ids = new Set<string>();
  let cursor: string | undefined;
  do {
    const page = await list({ prefix: PREFIX, cursor, limit: 1000 });
    page.blobs.forEach((b) => ids.add(b.pathname.slice(PREFIX.length).replace(/\.json$/, "")));
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  cache = { ids, at: Date.now() };
  return ids;
}

export async function recordTakedown(id: string, reason: string) {
  if (!blobEnabled()) return;
  await put(`${PREFIX}${id}.json`, JSON.stringify({ id, reason, at: new Date().toISOString() }), {
    access: "private",
    allowOverwrite: true,
    contentType: "application/json",
  });
  cache?.ids.add(id);
}
