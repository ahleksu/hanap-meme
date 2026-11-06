import { searchMemes } from "@/lib/search";
import { rateLimit } from "@/lib/http";
import { toPublic } from "@/lib/types";

export async function GET(req: Request) {
  const limited = rateLimit(req, "search", 60);
  if (limited) return limited;
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").slice(0, 200);
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit")) || 12, 1), 50);
  const { mode, memes } = await searchMemes(q, limit);
  return Response.json({ query: q, mode, count: memes.length, results: memes.map(toPublic) });
}
