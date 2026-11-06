import "./env";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import YAML from "yaml";
import pLimit from "p-limit";
import robotsParser from "robots-parser";
import { createCanvas, loadImage } from "@napi-rs/canvas";
import { getDb, MEME_DIR } from "../lib/db";
import { annotateImage } from "../lib/annotate";
import { embed, getOpenAI } from "../lib/openai";
import { embeddingText, tokenize } from "../lib/search";
import { exportCatalog } from "./catalog";
import type { Flags, MemeFormat, RightsStatus } from "../lib/types";

type Sources = {
  contact_url: string;
  inbox?: { enabled?: boolean; dir?: string };
  imgflip?: { enabled?: boolean; max?: number };
  giphy?: { enabled?: boolean; queries?: string[]; per_query?: number; rating?: string };
  templates?: { enabled?: boolean };
  pages?: { url: string; platform?: string; max_images?: number }[];
  urls?: (string | { url: string; source_url?: string; platform?: string; author?: string; approve?: boolean })[];
};

type Candidate = {
  origin: string; // the exact image URL or inbox path, used to skip work on re-runs
  load: () => Promise<Buffer>;
  source_url: string;
  source_platform: string;
  original_author: string | null;
  rights_status: RightsStatus;
  format?: MemeFormat; // forced format, e.g. "template" for our AI templates
  context: string;
  needsReview: boolean; // scraped page images are never stored without an AI safety review
  approve?: boolean; // maintainer override for person flags only, see AGENTS.md
  sidecar?: Partial<Record<string, unknown>>;
};

const args = process.argv.slice(2);
const limitArg = args.indexOf("--limit");
const LIMIT = limitArg >= 0 ? Number(args[limitArg + 1]) : 50;
const sourcesArg = args.indexOf("--sources");
const SOURCES_FILE = sourcesArg >= 0 ? args[sourcesArg + 1] : fs.existsSync("sources.yaml") ? "sources.yaml" : "sources.example.yaml";

const sources = YAML.parse(fs.readFileSync(SOURCES_FILE, "utf8")) as Sources;
const UA = `HanapMemeBot/0.1 (+${sources.contact_url})`;

// ---- polite fetching: robots.txt + 1 request / 2s per host ----
const nextSlot = new Map<string, number>();
async function politeFetch(url: string): Promise<Response> {
  const host = new URL(url).host;
  const now = Date.now();
  const at = Math.max(now, nextSlot.get(host) ?? 0);
  nextSlot.set(host, at + 2_000);
  if (at > now) await new Promise((r) => setTimeout(r, at - now));
  return fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(20_000) });
}

const robotsCache = new Map<string, ReturnType<typeof robotsParser> | null>();
async function allowed(url: string): Promise<boolean> {
  const origin = new URL(url).origin;
  if (!robotsCache.has(origin)) {
    const robotsUrl = `${origin}/robots.txt`;
    try {
      const res = await politeFetch(robotsUrl);
      // 4xx means no robots.txt, so everything is allowed. 5xx or a network error means stay away.
      if (res.ok) robotsCache.set(origin, robotsParser(robotsUrl, await res.text()));
      else robotsCache.set(origin, res.status < 500 ? robotsParser(robotsUrl, "") : null);
    } catch {
      robotsCache.set(origin, null);
    }
  }
  const robots = robotsCache.get(origin);
  return !!robots && robots.isAllowed(url, "HanapMemeBot") !== false;
}

async function download(url: string): Promise<Buffer> {
  if (!(await allowed(url))) throw new Error(`robots.txt disallows ${url}`);
  const res = await politeFetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

// ---- sources ----
function inboxCandidates(): Candidate[] {
  const dir = sources.inbox?.dir ?? "data/inbox";
  if (sources.inbox?.enabled === false || !fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => /\.(jpe?g|png|webp|gif)$/i.test(f))
    .map((f) => {
      const file = path.join(dir, f);
      const sidecarPath = file.replace(/\.[^.]+$/, ".json");
      const sidecar = fs.existsSync(sidecarPath) ? JSON.parse(fs.readFileSync(sidecarPath, "utf8")) : {};
      return {
        origin: `inbox:${f}`,
        load: async () => fs.readFileSync(file),
        source_url: sidecar.source_url ?? `local:${f}`,
        source_platform: sidecar.source_platform ?? "local",
        original_author: sidecar.original_author ?? null,
        rights_status: sidecar.rights_status === "own" ? "own" : "unverified",
        context: [f, sidecar.description_en, sidecar.description_tl].filter(Boolean).join(" | "),
        needsReview: false,
        approve: sidecar.approve === true,
        sidecar,
      };
    });
}

async function imgflipCandidates(): Promise<Candidate[]> {
  if (sources.imgflip?.enabled === false) return [];
  const res = await politeFetch("https://api.imgflip.com/get_memes");
  const json = (await res.json()) as { success: boolean; data: { memes: { id: string; name: string; url: string }[] } };
  if (!json.success) return [];
  return json.data.memes.slice(0, sources.imgflip?.max ?? 100).map((m) => ({
    origin: m.url,
    load: () => download(m.url),
    source_url: `https://imgflip.com/memetemplate/${m.id}`,
    source_platform: "imgflip",
    original_author: null,
    rights_status: "unverified",
    context: `Imgflip template name: ${m.name}`,
    needsReview: false,
  }));
}

// GIPHY search API (needs GIPHY_API_KEY). GIFs keep their animation and credit the GIPHY page + uploader.
async function giphyCandidates(): Promise<Candidate[]> {
  const key = process.env.GIPHY_API_KEY;
  if (sources.giphy?.enabled === false || !key) return [];
  type Gif = { url: string; title: string; username?: string; user?: { display_name?: string }; images: { downsized?: { url: string } } };
  const out: Candidate[] = [];
  for (const q of sources.giphy?.queries ?? ["pinoy", "filipino"]) {
    const url = new URL("https://api.giphy.com/v1/gifs/search");
    url.search = new URLSearchParams({ api_key: key, q, limit: String(sources.giphy?.per_query ?? 15), rating: sources.giphy?.rating ?? "pg", lang: "en" }).toString();
    const res = await politeFetch(url.href);
    if (!res.ok) {
      console.log(`  skip giphy "${q}" (HTTP ${res.status})`);
      continue;
    }
    for (const g of ((await res.json()) as { data: Gif[] }).data) {
      const media = g.images.downsized?.url?.split("?")[0];
      if (!media) continue;
      out.push({
        origin: media,
        load: () => download(media),
        source_url: g.url,
        source_platform: "giphy",
        original_author: g.user?.display_name || g.username || null,
        rights_status: "unverified",
        context: `GIPHY title: ${g.title} (search: ${q})`,
        needsReview: true,
      });
    }
  }
  return out;
}

// Our own AI-generated templates from `npm run templates`.
function templateCandidates(): Candidate[] {
  const manifest = path.join("public", "templates", "manifest.json");
  if (sources.templates?.enabled === false || !fs.existsSync(manifest)) return [];
  const { templates } = JSON.parse(fs.readFileSync(manifest, "utf8")) as { templates: { id: string; file: string; title: string; situations: string[] }[] };
  return templates.map((t) => ({
    origin: `template:${t.id}`,
    load: async () => fs.readFileSync(path.join("public", "templates", t.file)),
    source_url: `${sources.contact_url}/blob/main/public/templates/${t.file}`,
    source_platform: "hanapmeme-ai",
    original_author: "HanapMeme (AI-generated)",
    rights_status: "ai_generated",
    format: "template",
    context: `Original AI-generated meme template: ${t.title}. Situations: ${t.situations.join(", ")}`,
    needsReview: false,
    sidecar: { description_en: t.title, tags_situation: t.situations, format: "template" },
  }));
}

// Direct image or GIF links. robots.txt still applies when each one is downloaded.
function urlCandidates(): Candidate[] {
  return (sources.urls ?? []).map((entry) => {
    const e = typeof entry === "string" ? { url: entry } : entry;
    const host = new URL(e.url).hostname;
    return {
      origin: e.url,
      load: () => download(e.url),
      source_url: e.source_url ?? e.url,
      source_platform: e.platform ?? (host.match(/(tenor|giphy|imgur|pinimg|reddit)/)?.[1] ?? host),
      original_author: e.author ?? null,
      rights_status: "unverified",
      context: `Linked image from ${host}. Filename: ${e.url.split("/").pop()?.split("?")[0]}`,
      needsReview: true,
      approve: e.approve === true,
    };
  });
}

async function pageCandidates(): Promise<Candidate[]> {
  const out: Candidate[] = [];
  for (const page of sources.pages ?? []) {
    if (!(await allowed(page.url))) {
      console.log(`  skip page (robots.txt): ${page.url}`);
      continue;
    }
    const res = await politeFetch(page.url);
    if (!res.ok) {
      console.log(`  skip page (HTTP ${res.status}): ${page.url}`);
      continue;
    }
    const html = await res.text();
    const author = html.match(/<meta[^>]+name=["']author["'][^>]+content=["']([^"']+)/i)?.[1] ?? null;
    const urls = new Set<string>();
    for (const m of html.matchAll(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)/gi)) urls.add(m[1]);
    for (const m of html.matchAll(/<img[^>]+?(?:data-src|src)=["']([^"']+)["']/gi)) urls.add(m[1]);
    const imgs = [...urls]
      .map((u) => {
        try {
          return new URL(u.replace(/&amp;/g, "&"), page.url).href;
        } catch {
          return null;
        }
      })
      .filter((u): u is string => !!u && /^https?:/.test(u) && !/\.svg(\?|$)|icon|logo|sprite|avatar|pixel/i.test(u))
      .slice(0, page.max_images ?? 10);
    for (const u of imgs)
      out.push({
        origin: u,
        load: () => download(u),
        source_url: page.url,
        source_platform: page.platform ?? new URL(page.url).hostname,
        original_author: author,
        rights_status: "unverified",
        context: `Found on ${page.url}`,
        needsReview: true,
      });
  }
  return out;
}

// ---- processing ----
const MAX_GIF_BYTES = 6 * 1024 * 1024;
// More than one Graphic Control Extension block means more than one frame.
const isAnimatedGif = (b: Buffer) => b.subarray(0, 3).toString() === "GIF" && b.indexOf("\x21\xF9\x04", 0, "latin1") !== b.lastIndexOf("\x21\xF9\x04", undefined, "latin1");

/** Static images become max-1024px WebP. Animated GIFs are kept as-is; `webp` is then the first frame for review. */
async function normalize(buf: Buffer) {
  const img = await loadImage(buf);
  const scale = Math.min(1, 1024 / Math.max(img.width, img.height));
  const w = Math.round(img.width * scale);
  const h = Math.round(img.height * scale);
  const canvas = createCanvas(w, h);
  canvas.getContext("2d").drawImage(img, 0, 0, w, h);
  const webp = await canvas.encode("webp", 85);
  if (isAnimatedGif(buf) && buf.length <= MAX_GIF_BYTES) return { webp, stored: buf, ext: "gif", width: img.width, height: img.height };
  return { webp, stored: webp, ext: "webp", width: w, height: h };
}

// Approval can lift person flags only. Explicit or hateful content is never served.
const overridable = (f: Flags) => !f.explicit && !f.hateful;

const NO_FLAGS: Flags = { possible_minor: false, private_individual: false, explicit: false, hateful: false };

async function main() {
  const db = getDb();
  fs.mkdirSync(MEME_DIR, { recursive: true });
  const hasKey = !!getOpenAI();
  console.log(`HanapMeme ingest · sources=${SOURCES_FILE} · limit=${LIMIT} · ${hasKey ? "AI annotation on" : "NO KEY: metadata only"}`);

  const candidates = [
    ...templateCandidates(),
    ...inboxCandidates(),
    ...urlCandidates(),
    ...(await giphyCandidates()),
    ...(await imgflipCandidates()),
    ...(await pageCandidates()),
  ];
  console.log(`${candidates.length} candidates`);

  const byOrigin = db.prepare("SELECT id, annotated FROM memes WHERE origin_url = ?");
  const bySha = db.prepare("SELECT id, annotated FROM memes WHERE sha256 = ?");
  const upsert = db.prepare(`
    INSERT INTO memes (id, file, sha256, width, height, source_url, source_platform, original_author, retrieved_at,
      rights_status, description_tl, description_en, ocr_text, tags_emotion, tags_situation, format, language, flags,
      status, annotated, origin_url, embedding)
    VALUES (@id, @file, @sha256, @width, @height, @source_url, @source_platform, @original_author, @retrieved_at,
      @rights_status, @description_tl, @description_en, @ocr_text, @tags_emotion, @tags_situation, @format, @language,
      @flags, @status, @annotated, @origin_url, @embedding)
    ON CONFLICT(sha256) DO UPDATE SET
      description_tl = excluded.description_tl, description_en = excluded.description_en, ocr_text = excluded.ocr_text,
      tags_emotion = excluded.tags_emotion, tags_situation = excluded.tags_situation, format = excluded.format,
      language = excluded.language, flags = excluded.flags, annotated = excluded.annotated, embedding = excluded.embedding,
      -- never resurrect a takedown; a new review can only exclude, not re-activate
      status = CASE WHEN memes.status = 'takedown' THEN 'takedown'
                    WHEN memes.status = 'excluded' THEN 'excluded' ELSE excluded.status END`);

  // Approved links that an earlier run excluded: lift the exclusion without paying for a new review.
  const approve = db.prepare("UPDATE memes SET status = 'active' WHERE origin_url = ? AND status = 'excluded' AND flags = ?");
  for (const c of candidates.filter((c) => c.approve)) {
    const row = db.prepare("SELECT flags FROM memes WHERE origin_url = ?").get(c.origin) as { flags: string } | undefined;
    if (row && overridable(JSON.parse(row.flags)) && approve.run(c.origin, row.flags).changes)
      console.log(`  approve override: ${c.origin}`);
  }

  let done = 0;
  let reserved = 0; // slots taken by in-flight work, so parallel tasks never pass --limit
  const counts = { active: 0, excluded: 0, skipped: 0, failed: 0 };
  // Up to 4 images in flight. politeFetch still holds each host to 1 request / 2s.
  const pool = pLimit(4);
  await Promise.all(candidates.map((c) => pool(async () => {
    if (reserved >= LIMIT) return;
    const prev = byOrigin.get(c.origin) as { annotated: number } | undefined;
    if (prev && (prev.annotated || !hasKey)) return; // already as good as this run can make it
    if (c.needsReview && !hasKey) {
      counts.skipped++;
      return;
    }
    reserved++;
    let kept = false;
    try {
      const raw = await c.load();
      const sha256 = crypto.createHash("sha256").update(raw).digest("hex");
      const dup = bySha.get(sha256) as { annotated: number } | undefined;
      if (dup && (dup.annotated || !hasKey)) {
        db.prepare("UPDATE memes SET origin_url = COALESCE(origin_url, ?) WHERE sha256 = ?").run(c.origin, sha256);
        return;
      }
      const { webp, stored, ext, width, height } = await normalize(raw);
      if (Math.min(width, height) < 100) {
        counts.skipped++;
        return;
      }
      const id = sha256.slice(0, 12);
      const file = `${id}.${ext}`;
      fs.writeFileSync(path.join(MEME_DIR, file), stored);

      const ann = hasKey ? await annotateImage(webp, c.context) : null;
      const sc = c.sidecar ?? {};
      const fallbackText = c.context.replace(/^Imgflip template name: /, "");
      const meta = ann ?? {
        description_tl: String(sc.description_tl ?? ""),
        description_en: String(sc.description_en ?? fallbackText),
        ocr_text: String(sc.ocr_text ?? ""),
        tags_emotion: (sc.tags_emotion as string[]) ?? [],
        tags_situation: (sc.tags_situation as string[]) ?? tokenize(fallbackText),
        format: ((sc.format as MemeFormat) ?? (c.source_platform === "imgflip" ? "template" : "reaction")) as MemeFormat,
        language: String(sc.language ?? "en"),
        flags: NO_FLAGS,
      };
      if (c.format) meta.format = c.format;
      const flagged = Object.values(meta.flags).some(Boolean);
      const vec = ann ? (await embed([embeddingText(meta)]))?.[0] : null;
      const status = flagged && !(c.approve && overridable(meta.flags)) ? "excluded" : "active";
      if (flagged && status === "active") console.log(`  approve override: ${c.origin}`);
      upsert.run({
        id,
        file,
        sha256,
        width,
        height,
        source_url: c.source_url,
        source_platform: c.source_platform,
        original_author: c.original_author,
        retrieved_at: new Date().toISOString(),
        rights_status: c.rights_status,
        description_tl: meta.description_tl,
        description_en: meta.description_en,
        ocr_text: meta.ocr_text,
        tags_emotion: JSON.stringify(meta.tags_emotion),
        tags_situation: JSON.stringify(meta.tags_situation),
        format: meta.format,
        language: meta.language,
        flags: JSON.stringify(meta.flags),
        status,
        annotated: ann ? 1 : 0,
        origin_url: c.origin,
        embedding: vec ? JSON.stringify(vec) : null,
      });
      done++;
      kept = true;
      counts[status]++;
      const why = flagged ? ` (flags: ${Object.entries(meta.flags).filter(([, v]) => v).map(([k]) => k).join(", ")})` : "";
      console.log(`[${done}/${LIMIT}] ${c.source_platform} ${id} → ${status}${why} · ${meta.description_en.slice(0, 60)}`);
    } catch (e) {
      counts.failed++;
      console.log(`  fail ${c.origin}: ${(e as Error).message}`);
    } finally {
      if (!kept) reserved--;
    }
  })));

  const n = await exportCatalog();
  console.log(`Done. new/updated=${done} active=${counts.active} excluded=${counts.excluded} skipped=${counts.skipped} failed=${counts.failed}. catalog.json has ${n} active memes.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
