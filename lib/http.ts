const buckets = new Map<string, { n: number; reset: number }>();

// shortcut: in-memory fixed window per process, fine for one server; move to Redis/KV when you scale out.
export function rateLimit(req: Request, key: string, max: number, windowMs = 60_000): Response | null {
  const id = `${key}:${clientIp(req) ?? "unknown"}`;
  const now = Date.now();
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

export function clientIp(req: Request): string | null {
  return req.headers.get("x-forwarded-for")?.split(",")[0].trim() || req.headers.get("x-real-ip") || null;
}

export function siteUrl(req: Request): string {
  return process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin;
}
