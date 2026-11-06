import assert from "node:assert/strict";
import { test } from "node:test";
import { keywordSearch, tokenize } from "./search";
import type { Meme } from "./types";

const meme = (id: string, description_en: string, tags: string[] = []): Meme => ({
  id, file: `${id}.webp`, sha256: id, width: 1, height: 1, source_url: "", source_platform: "test", original_author: null,
  retrieved_at: "", rights_status: "own", description_tl: "", description_en, ocr_text: "", tags_emotion: tags,
  tags_situation: [], subjects: [], references: [], context_note: "", format: "reaction", language: "en", status: "active",
  flags: { possible_minor: false, private_individual: false, explicit: false, hateful: false },
});

test("tokenize drops Tagalog and English stopwords", () => {
  assert.deepEqual(tokenize("Pagod na sa Monday!"), ["pagod", "monday"]);
});

test("keyword search finds a synonym match with no API key", () => {
  const memes = [meme("a", "A man is exhausted at his desk", ["tired"]), meme("b", "A cat eating cake", ["happy"])];
  const ids = keywordSearch("pagod na sa Monday", memes, 5).map((m) => m.id);
  assert.deepEqual(ids, ["a"]);
});

test("a named subject is searchable", () => {
  const memes = [{ ...meme("vice", "A host laughing on stage"), subjects: ["Vice Ganda"], references: ["it's showtime"] }, meme("x", "A cat")];
  assert.equal(keywordSearch("vice ganda showtime meme", memes, 5)[0].id, "vice");
});

test("exact words outrank synonyms", () => {
  const memes = [meme("syn", "so sleepy"), meme("exact", "pagod talaga")];
  assert.equal(keywordSearch("pagod", memes, 5)[0].id, "exact");
});
