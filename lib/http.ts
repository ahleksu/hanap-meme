const buckets = new Map<string, { n: number; reset: number }>();

// shortcut: in-memory fixed window per process, fine for one server; move to Redis/KV when you scale out.
export function rateLimit(req: Request, key: string, max: number, windowMs = 60_000, global = false): Response | null {
  const id = global ? key : `${key}:${clientIp(req) ?? "unknown"}`;
  const now = Date.now();
  if (buckets.size > 10_000) for (const [k, v] of buckets) if (v.reset < now) buckets.delete(k);
  const b = buckets.get(id);
  if (!b || b.reset < now) {
    buckets.set(id, { n: 1, reset: now + windowMs });
    return null;
  }
  if (++b.n <= max) return null;
  return Response.json(
    { error: "Too many requests. Dahan-dahan lang." },
    { status: 429, headers: { "Retry-After": String(Math.ceil((b.reset - now) / 1000)) } },
  );
}

// On Vercel the platform sets x-vercel-forwarded-for, so clients cannot spoof it.
// Elsewhere X-Forwarded-For is only as trustworthy as the proxy in front of the app.
export function clientIp(req: Request): string | null {
  const h = req.headers;
  const ip = process.env.VERCEL ? h.get("x-vercel-forwarded-for") : h.get("x-forwarded-for") ?? h.get("x-real-ip");
  return ip?.split(",")[0].trim() || null;
}

export function siteUrl(req: Request): string {
  return process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin;
}
