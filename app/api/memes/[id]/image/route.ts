import fs from "node:fs/promises";
import path from "node:path";
import { getActive, MEME_DIR } from "@/lib/db";

// Images live outside public/ so excluded and takedown items can never be fetched by URL.
export async function GET(_req: Request, ctx: RouteContext<"/api/memes/[id]/image">) {
  const { id } = await ctx.params;
  const meme = await getActive(id);
  if (!meme) return new Response("Not found", { status: 404 });
  try {
    const buf = await fs.readFile(path.join(MEME_DIR, path.basename(meme.file)));
    return new Response(new Uint8Array(buf), {
      headers: { "Content-Type": meme.file.endsWith(".gif") ? "image/gif" : "image/webp", "Cache-Control": "no-cache" },
    });
  } catch {
    return new Response("Image file missing. Run npm run ingest.", { status: 404 });
  }
}
