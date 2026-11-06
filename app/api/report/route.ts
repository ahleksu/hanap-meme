import { z } from "zod";
import { reportMeme } from "@/lib/db";
import { clientIp, rateLimit } from "@/lib/http";

const Body = z.object({ id: z.string().min(1).max(64), reason: z.string().trim().min(1).max(1000) });

export async function POST(req: Request) {
  const limited = rateLimit(req, "report", 10);
  if (limited) return limited;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Send {id, reason}." }, { status: 400 });
  const { id, reason } = parsed.data;
  try {
    if (!(await reportMeme(id, reason, clientIp(req)))) return Response.json({ error: "Not found" }, { status: 404 });
  } catch (e) {
    console.error("[report] could not save takedown:", (e as Error).message);
    return Response.json({ error: "Report could not be saved. Please use the takedown issue form." }, { status: 503 });
  }
  console.log(`[report] takedown ${id}: ${reason.replace(/\s+/g, " ").slice(0, 200)}`);
  return Response.json({ ok: true, id, status: "takedown", message: "Salamat. Tinanggal na." });
}
