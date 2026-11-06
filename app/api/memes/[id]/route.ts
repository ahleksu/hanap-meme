import { getActive } from "@/lib/db";
import { toPublic } from "@/lib/types";

export async function GET(_req: Request, ctx: RouteContext<"/api/memes/[id]">) {
  const { id } = await ctx.params;
  const meme = await getActive(id);
  if (!meme) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json(toPublic(meme));
}
