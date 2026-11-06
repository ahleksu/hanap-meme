import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { blobEnabled, recordTakedown, takedownIds } from "./takedowns";
import type { Flags, Meme, MemeStatus } from "./types";

export const DATA_DIR = path.join(/* turbopackIgnore: true */ process.cwd(), "data");
export const MEME_DIR = path.join(DATA_DIR, "memes");
// Paths opt out of build tracing. next.config.ts lists the runtime files explicitly.
const DB_PATH = path.join(DATA_DIR, "hanapmeme.db");

// Vercel functions have a read-only filesystem. The bundled database is opened read-only there.
const READ_ONLY = !!process.env.VERCEL;

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (db) return db;
  if (READ_ONLY) {
    db = fs.existsSync(DB_PATH) ? new Database(DB_PATH, { readonly: true }) : new Database(":memory:");
    if (db.memory) createSchema(db);
    return db;
  }
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  db = new Database(DB_PATH);
  // Rollback journal, not WAL, so the .db file is self-contained when bundled into a deploy.
  db.pragma("journal_mode = DELETE");
  createSchema(db);
  return db;
}

function createSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS memes (
      id TEXT PRIMARY KEY,
      file TEXT NOT NULL,
      sha256 TEXT NOT NULL UNIQUE,
      width INTEGER NOT NULL,
      height INTEGER NOT NULL,
      source_url TEXT NOT NULL,
      source_platform TEXT NOT NULL,
      original_author TEXT,
      retrieved_at TEXT NOT NULL,
      rights_status TEXT NOT NULL,
      description_tl TEXT NOT NULL DEFAULT '',
      description_en TEXT NOT NULL DEFAULT '',
      ocr_text TEXT NOT NULL DEFAULT '',
      tags_emotion TEXT NOT NULL DEFAULT '[]',
      tags_situation TEXT NOT NULL DEFAULT '[]',
      subjects TEXT NOT NULL DEFAULT '[]',
      refs TEXT NOT NULL DEFAULT '[]',
      context_note TEXT NOT NULL DEFAULT '',
      format TEXT NOT NULL DEFAULT 'reaction',
      language TEXT NOT NULL DEFAULT '',
      flags TEXT NOT NULL DEFAULT '{}',
      status TEXT NOT NULL DEFAULT 'active',
      annotated INTEGER NOT NULL DEFAULT 0,
      origin_url TEXT,
      embedding TEXT
    );
    CREATE INDEX IF NOT EXISTS memes_origin ON memes(origin_url);
    CREATE INDEX IF NOT EXISTS memes_status ON memes(status);
    CREATE TABLE IF NOT EXISTS reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      meme_id TEXT NOT NULL,
      reason TEXT NOT NULL,
      ip TEXT,
      created_at TEXT NOT NULL
    );
  `);
  // Databases made before the context fields existed get the new columns.
  const cols = new Set((db.prepare("PRAGMA table_info(memes)").all() as { name: string }[]).map((c) => c.name));
  if (!cols.has("subjects")) db.exec("ALTER TABLE memes ADD COLUMN subjects TEXT NOT NULL DEFAULT '[]'");
  if (!cols.has("refs")) db.exec("ALTER TABLE memes ADD COLUMN refs TEXT NOT NULL DEFAULT '[]'");
  if (!cols.has("context_note")) db.exec("ALTER TABLE memes ADD COLUMN context_note TEXT NOT NULL DEFAULT ''");
}

type Row = Record<string, unknown>;

function rowToMeme(r: Row): Meme {
  return {
    ...(r as unknown as Meme),
    tags_emotion: JSON.parse(r.tags_emotion as string),
    tags_situation: JSON.parse(r.tags_situation as string),
    subjects: JSON.parse(r.subjects as string),
    references: JSON.parse(r.refs as string),
    flags: JSON.parse(r.flags as string) as Flags,
  };
}

const COLS = `id, file, sha256, width, height, source_url, source_platform, original_author, retrieved_at,
  rights_status, description_tl, description_en, ocr_text, tags_emotion, tags_situation, subjects, refs, context_note,
  format, language, flags, status`;

/** Every read the app serves goes through here, so only active memes ever leave the server. */
export async function listActive(): Promise<Meme[]> {
  const removed = await takedownIds();
  return getDb()
    .prepare(`SELECT ${COLS} FROM memes WHERE status = 'active' ORDER BY retrieved_at DESC`)
    .all()
    .map((r) => rowToMeme(r as Row))
    .filter((m) => !removed.has(m.id));
}

export async function getActive(id: string): Promise<Meme | null> {
  const r = getDb().prepare(`SELECT ${COLS} FROM memes WHERE id = ? AND status = 'active'`).get(id);
  if (!r || (await takedownIds()).has(id)) return null;
  return rowToMeme(r as Row);
}

/** Embeddings never change for an id, so the parsed vectors are cached for the process lifetime. */
const vectorCache = new Map<string, Float32Array>();
export function getEmbeddings(ids: string[]): Map<string, Float32Array> {
  const missing = ids.filter((id) => !vectorCache.has(id));
  if (missing.length) {
    const stmt = getDb().prepare("SELECT embedding FROM memes WHERE id = ? AND embedding IS NOT NULL");
    for (const id of missing) {
      const r = stmt.get(id) as { embedding: string } | undefined;
      if (r) vectorCache.set(id, Float32Array.from(JSON.parse(r.embedding)));
    }
  }
  const out = new Map<string, Float32Array>();
  for (const id of ids) {
    const v = vectorCache.get(id);
    if (v) out.set(id, v);
  }
  return out;
}

export async function reportMeme(id: string, reason: string, ip: string | null): Promise<boolean> {
  if (!(await getActive(id))) return false;
  // A read-only deploy with no Blob store cannot persist a takedown, so fail loudly instead of pretending.
  if (READ_ONLY && !blobEnabled()) throw new Error("Takedowns need a Vercel Blob store on this deploy");
  await recordTakedown(id, reason);
  if (READ_ONLY) return true;
  const d = getDb();
  d.prepare("UPDATE memes SET status = 'takedown' WHERE id = ?").run(id);
  d.prepare("INSERT INTO reports (meme_id, reason, ip, created_at) VALUES (?, ?, ?, ?)").run(
    id,
    reason,
    ip,
    new Date().toISOString(),
  );
  return true;
}

export function setStatus(id: string, status: MemeStatus) {
  getDb().prepare("UPDATE memes SET status = ? WHERE id = ?").run(status, id);
}
