import { z } from "zod";
import { generateMeme } from "@/lib/generate";
import { rateLimit } from "@/lib/http";

const Body = z.object({ situation: z.string().trim().min(1).max(300), templateId: z.string().max(64).optional() });

export async function POST(req: Request) {
  const limited = rateLimit(req, "generate", 10);
  if (limited) return limited;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Send {situation, templateId?}." }, { status: 400 });
  const { png, top, bottom, templateId, captionSource } = await generateMeme(parsed.data.situation, parsed.data.templateId);
  return new Response(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      // Header values must be ASCII, so captions are URI-encoded.
      "X-Caption-Top": encodeURIComponent(top),
      "X-Caption-Bottom": encodeURIComponent(bottom),
      "X-Template-Id": templateId ?? "none",
      "X-Caption-Source": captionSource,
    },
  });
}
