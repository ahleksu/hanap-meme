import "./env";
import fs from "node:fs";
import path from "node:path";
import { getOpenAI } from "../lib/openai";

// gpt-image-2 rejects transparent backgrounds, so stickers use gpt-image-1.5.
const MODEL = process.env.OPENAI_BRAND_IMAGE_MODEL || "gpt-image-1.5";

// One-off design assets for the landing page. Committed to the repo, so teammates never need to run this.
const DIR = path.join("public", "brand");
const ASSETS = [
  {
    file: "mascot.png",
    prompt:
      "A cute cartoon mascot: a chubby magnifying glass character with big shiny eyes and a cheeky grin, wearing a tiny salakot hat, waving one hand. Bold black outlines, flat colors in sunny yellow (#f5b301), jeepney red (#e63946) and royal blue (#1d3fbb). Sticker style with a thick white border. Transparent background. No text, no logos.",
  },
  {
    file: "sticker-jeep.png",
    prompt:
      "A playful sticker of a colorful cartoon Filipino jeepney with motion lines, chrome horses on the hood, bold black outlines, flat electric yellow, hot pink and cream colors, thick white sticker border. Transparent background. No text, no letters, no brand names.",
  },
  {
    file: "sticker-coffee.png",
    prompt:
      "A playful sticker of a cartoon steaming coffee mug with a tired, half-asleep face and sweat drop, bold black outlines, flat colors, thick white sticker border. Transparent background. No text, no letters, no logos.",
  },
];

async function main() {
  const ai = getOpenAI();
  if (!ai) throw new Error("OPENAI_API_KEY is not set");
  fs.mkdirSync(DIR, { recursive: true });
  for (const a of ASSETS) {
    const out = path.join(DIR, a.file);
    if (fs.existsSync(out)) {
      console.log(`skip ${a.file}`);
      continue;
    }
    console.log(`generating ${a.file} with ${MODEL}…`);
    const res = await ai.images.generate(
      { model: MODEL, prompt: a.prompt, size: "1024x1024", quality: "medium", background: "transparent", output_format: "png" },
      { timeout: 180_000 },
    );
    const b64 = res.data?.[0]?.b64_json;
    if (!b64) throw new Error(`no image for ${a.file}`);
    fs.writeFileSync(out, Buffer.from(b64, "base64"));
  }
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
