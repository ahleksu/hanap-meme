import { z } from "zod";
import { zodTextFormat } from "openai/helpers/zod";
import { getEmbeddings, listActive } from "./db";
import { embed, getOpenAI, TEXT_MODEL } from "./openai";
import type { Meme } from "./types";

export type SearchMode = "semantic" | "semantic+rerank" | "keyword";
export type SearchResult = { mode: SearchMode; memes: Meme[] };

// Each group is one feeling or situation. A query word pulls in the rest of its group at half weight.
const SYNONYMS: string[][] = [
  ["kilig", "sweet", "landi", "crush", "inlove", "love", "romantic", "jowa"],
  ["pikon", "galit", "badtrip", "inis", "angry", "mad", "annoyed", "asar", "rage"],
  ["sweldo", "pera", "payday", "money", "salary", "budget", "gcash", "wallet", "broke", "petsa", "peligro"],
  ["pagod", "antok", "monday", "tired", "sleepy", "exhausted", "puyat", "sleep", "drained", "lunes", "inaantok"],
  ["tita", "chismis", "marites", "gossip", "tsismis", "judgy", "judge", "nosy"],
  ["late", "huli", "traffic", "standup", "meeting", "nalate", "delayed", "rush"],
  ["gutom", "hungry", "food", "kain", "eat", "pagkain", "lunch"],
  ["iyak", "sad", "malungkot", "cry", "crying", "lungkot", "sakit", "hurt"],
  ["tawa", "happy", "saya", "laugh", "masaya", "lol", "haha", "funny"],
  ["gulat", "shocked", "surprised", "shock", "nagulat", "omg"],
  ["confused", "lito", "nalilito", "huh", "ano", "bakit"],
  ["exam", "school", "student", "aral", "study", "estudyante", "deadline", "thesis"],
  ["trabaho", "work", "office", "boss", "opisina", "overtime", "ot", "job"],
  ["ulan", "rain", "baha", "flood", "commute", "jeep", "jeepney", "mrt"],
  ["proud", "flex", "yabang", "confident", "win", "panalo"],
  ["fail", "talo", "sablay", "mistake", "oops", "palpak"],
];
const SYN = new Map<string, Set<string>>();
for (const group of SYNONYMS) for (const w of group) {
  const s = SYN.get(w) ?? new Set<string>();
  group.forEach((g) => g !== w && s.add(g));
  SYN.set(w, s);
}

const STOP = new Set(
  "sa na ng ang mga para ako ko mo ka si ni at ay naman lang pa ba po yung yun the a an of to for is my me i when meme memes ung nang kung".split(" "),
);

export function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 1 && !STOP.has(t));
}

function docText(m: Meme): string {
  // Names and references are repeated so a search for "vice ganda" or "showtime" outranks a passing mention.
  const named = [...m.subjects, ...m.references].join(" ");
  return [m.description_tl, m.description_en, m.ocr_text, ...m.tags_emotion, ...m.tags_situation, named, named, m.context_note].join(" ");
}

type EmbedFields = "description_tl" | "description_en" | "ocr_text" | "tags_emotion" | "tags_situation" | "subjects" | "references" | "context_note";
export function embeddingText(m: Pick<Meme, EmbedFields>) {
  return [
    m.subjects.length ? `Who/what: ${m.subjects.join(", ")}` : "",
    m.references.length ? `References: ${m.references.join(", ")}` : "",
    m.context_note,
    m.description_tl,
    m.description_en,
    m.ocr_text,
    [...m.tags_emotion, ...m.tags_situation].join(", "),
  ]
    .filter(Boolean)
    .join("\n");
}

/** BM25 (k1 = 1.2, b = 0.75) with synonym expansion. Works with no API key. */
export function keywordSearch(query: string, memes: Meme[], limit: number): Meme[] {
  const q = new Map<string, number>();
  for (const t of tokenize(query)) {
    q.set(t, 1);
    for (const s of SYN.get(t) ?? []) if (!q.has(s)) q.set(s, 0.5);
  }
  if (!q.size) return [];
  const docs = memes.map((m) => tokenize(docText(m)));
  const avgLen = docs.reduce((a, d) => a + d.length, 0) / Math.max(docs.length, 1) || 1;
  const df = new Map<string, number>();
  for (const d of docs) for (const t of new Set(d)) df.set(t, (df.get(t) ?? 0) + 1);
  const N = docs.length;
  const scored = docs.map((d, i) => {
    const tf = new Map<string, number>();
    for (const t of d) tf.set(t, (tf.get(t) ?? 0) + 1);
    let score = 0;
    for (const [t, w] of q) {
      const f = tf.get(t);
      if (!f) continue;
      const n = df.get(t)!;
      const idf = Math.log(1 + (N - n + 0.5) / (n + 0.5));
      score += w * idf * ((f * 2.2) / (f + 1.2 * (0.25 + (0.75 * d.length) / avgLen)));
    }
    return { m: memes[i], score };
  });
  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => s.m);
}

function cosine(a: ArrayLike<number>, b: ArrayLike<number>) {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / (Math.sqrt(na * nb) || 1);
}

const Rerank = z.object({ ids: z.array(z.string()) });

async function rerank(query: string, candidates: Meme[], limit: number): Promise<Meme[] | null> {
  const ai = getOpenAI();
  if (!ai || candidates.length <= 1) return null;
  try {
    const list = candidates
      .map((m) => `${m.id}: ${m.subjects.join(", ")} | ${m.description_tl} | ${m.description_en} | ${m.ocr_text} | ${m.tags_emotion.join(",")}`)
      .join("\n");
    const res = await ai.responses.parse(
      {
        model: TEXT_MODEL,
        reasoning: { effort: "low" },
        input: [
          {
            role: "system",
            content:
              "You rank Filipino memes for a Taglish search query. Return the ids of the best matches, best first. Only use ids from the list.",
          },
          { role: "user", content: `Query: ${query}\nReturn up to ${limit} ids.\n\n${list}` },
        ],
        text: { format: zodTextFormat(Rerank, "rerank") },
      },
      { timeout: 3_000, maxRetries: 0 },
    );
    const byId = new Map(candidates.map((m) => [m.id, m]));
    const ranked = (res.output_parsed?.ids ?? []).map((id) => byId.get(id)).filter((m): m is Meme => !!m);
    if (!ranked.length) return null;
    // Keep candidates the model dropped at the end so the page is never shorter than cosine alone.
    const seen = new Set(ranked.map((m) => m.id));
    return [...ranked, ...candidates.filter((m) => !seen.has(m.id))].slice(0, limit);
  } catch (e) {
    console.warn("[search] rerank skipped:", (e as Error).message);
    return null;
  }
}

export async function searchMemes(query: string, limit = 12, opts: { rerank?: boolean } = {}): Promise<SearchResult> {
  const memes = await listActive();
  const q = query.trim();
  if (!q) return { mode: "keyword", memes: memes.slice(0, limit) };

  const vectors = getEmbeddings(memes.map((m) => m.id));
  const qv = vectors.size ? (await embed([q], 5_000))?.[0] : null;
  if (!qv) return { mode: "keyword", memes: keywordSearch(q, memes, limit) };

  const top = memes
    .filter((m) => vectors.has(m.id))
    .map((m) => ({ m, s: cosine(qv, vectors.get(m.id)!) }))
    .sort((a, b) => b.s - a.s)
    .slice(0, 30)
    .map((x) => x.m);
  if (opts.rerank !== false) {
    const ranked = await rerank(q, top, limit);
    if (ranked) return { mode: "semantic+rerank", memes: ranked };
  }
  return { mode: "semantic", memes: top.slice(0, limit) };
}
