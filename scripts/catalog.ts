import fs from "node:fs";
import { listActive } from "../lib/db";

/** catalog.json holds provenance and metadata for active memes only. No image bytes, no embeddings. */
export async function exportCatalog(): Promise<number> {
  const memes = (await listActive())
    .map((m) => ({
      id: m.id,
      width: m.width,
      height: m.height,
      source_url: m.source_url,
      source_platform: m.source_platform,
      original_author: m.original_author,
      retrieved_at: m.retrieved_at,
      rights_status: m.rights_status,
      description_tl: m.description_tl,
      description_en: m.description_en,
      ocr_text: m.ocr_text,
      tags_emotion: m.tags_emotion,
      tags_situation: m.tags_situation,
      subjects: m.subjects,
      references: m.references,
      context_note: m.context_note,
      format: m.format,
      language: m.language,
    }))
    .sort((a, b) => a.id.localeCompare(b.id));
  fs.writeFileSync("catalog.json", JSON.stringify({ generated_at: new Date().toISOString(), count: memes.length, memes }, null, 2) + "\n");
  return memes.length;
}
