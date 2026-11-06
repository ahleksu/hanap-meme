import fs from "node:fs/promises";
import path from "node:path";
import { createCanvas, loadImage } from "@napi-rs/canvas";
import { MEME_DIR } from "./db";
import type { Meme } from "./types";

/** Image bytes of a meme, longest side at most `max` px. Animated GIFs pass through only at full size. */
export async function memeImage(m: Meme, max = 1024): Promise<{ data: Buffer; mimeType: string }> {
  const buf = await fs.readFile(path.join(MEME_DIR, path.basename(m.file)));
  const gif = m.file.endsWith(".gif");
  if (Math.max(m.width, m.height) <= max) return { data: buf, mimeType: gif ? "image/gif" : "image/webp" };
  const img = await loadImage(buf);
  const s = max / Math.max(img.width, img.height);
  const canvas = createCanvas(Math.round(img.width * s), Math.round(img.height * s));
  canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
  return { data: await canvas.encode("webp", 80), mimeType: "image/webp" };
}
