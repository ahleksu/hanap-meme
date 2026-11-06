import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { zodTextFormat } from "openai/helpers/zod";
import { createCanvas, GlobalFonts, loadImage, type SKRSContext2D } from "@napi-rs/canvas";
import { getOpenAI, TEXT_MODEL } from "./openai";
import { tokenize } from "./search";

export type Template = { id: string; file: string; title: string; situations: string[]; prompt: string };

export const TEMPLATE_DIR = path.join(/* turbopackIgnore: true */ process.cwd(), "public", "templates");
GlobalFonts.registerFromPath(path.join(/* turbopackIgnore: true */ process.cwd(), "assets", "fonts", "Anton-Regular.ttf"), "Anton");

export function loadTemplates(): Template[] {
  try {
    return JSON.parse(fs.readFileSync(path.join(TEMPLATE_DIR, "manifest.json"), "utf8")).templates;
  } catch {
    return [];
  }
}

const Caption = z.object({ templateId: z.string(), top: z.string(), bottom: z.string() });
const clip = (s: string) => s.trim().toUpperCase().slice(0, 40);

async function aiCaption(situation: string, templates: Template[], templateId?: string) {
  const ai = getOpenAI();
  if (!ai) return null;
  try {
    const list = templates.map((t) => `${t.id}: ${t.title} (${t.situations.join(", ")})`).join("\n");
    const res = await ai.responses.parse(
      {
        model: TEXT_MODEL,
        reasoning: { effort: "low" },
        input: [
          {
            role: "system",
            content:
              "You write funny Filipino memes in natural Taglish. Pick the best template id, then write a top and bottom caption, each at most 40 characters. No real people's names, no slurs.",
          },
          {
            role: "user",
            content: `Situation: ${situation}\n${templateId ? `Use template: ${templateId}\n` : ""}Templates:\n${list || "(none: use templateId \"none\")"}`,
          },
        ],
        text: { format: zodTextFormat(Caption, "caption") },
      },
      { timeout: 15_000, maxRetries: 0 },
    );
    return res.output_parsed;
  } catch (e) {
    console.warn("[generate] caption fallback:", (e as Error).message);
    return null;
  }
}

function pickTemplate(situation: string, templates: Template[]): Template | undefined {
  const words = new Set(tokenize(situation));
  let best: Template | undefined;
  let bestScore = -1;
  for (const t of templates) {
    const score = tokenize(`${t.title} ${t.situations.join(" ")}`).filter((w) => words.has(w)).length;
    if (score > bestScore) [best, bestScore] = [t, score];
  }
  return best;
}

function wrap(ctx: SKRSContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

function drawCaption(ctx: SKRSContext2D, text: string, w: number, h: number, where: "top" | "bottom") {
  if (!text) return;
  let size = Math.round(w / 9);
  let lines: string[];
  do {
    ctx.font = `${size}px Anton`;
    lines = wrap(ctx, text, w * 0.92);
    size -= 4;
  } while (lines.length > 2 && size > 24);
  const lh = size * 1.15;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.lineJoin = "round";
  ctx.lineWidth = Math.max(4, size / 8);
  ctx.strokeStyle = "black";
  ctx.fillStyle = "white";
  const y0 = where === "top" ? h * 0.03 : h - h * 0.06 - lines.length * lh;
  lines.forEach((l, i) => {
    ctx.strokeText(l, w / 2, y0 + i * lh);
    ctx.fillText(l, w / 2, y0 + i * lh);
  });
}

export async function generateMeme(situation: string, templateId?: string) {
  const templates = loadTemplates();
  const ai = await aiCaption(situation, templates, templateId);
  const template =
    templates.find((t) => t.id === (templateId ?? ai?.templateId)) ?? pickTemplate(situation, templates);
  const top = clip(ai?.top ?? situation);
  const bottom = clip(ai?.bottom ?? "Ganun talaga, beh");

  const W = 1024;
  let H = 1024;
  const img = template ? await loadImage(path.join(TEMPLATE_DIR, path.basename(template.file))) : null;
  if (img) H = Math.round((img.height / img.width) * W);
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");
  if (img) ctx.drawImage(img, 0, 0, W, H);
  else {
    ctx.fillStyle = "#1f2937";
    ctx.fillRect(0, 0, W, H);
  }
  drawCaption(ctx, top, W, H, "top");
  drawCaption(ctx, bottom, W, H, "bottom");

  // Every generated meme carries this label.
  const label = "AI-generated · HanapMeme";
  ctx.font = "22px Anton";
  ctx.textAlign = "right";
  ctx.textBaseline = "bottom";
  const lw = ctx.measureText(label).width;
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.fillRect(W - lw - 22, H - 36, lw + 16, 30);
  ctx.fillStyle = "white";
  ctx.fillText(label, W - 14, H - 9);

  return {
    png: await canvas.encode("png"),
    top,
    bottom,
    templateId: template?.id ?? null,
    captionSource: ai ? ("ai" as const) : ("fallback" as const),
  };
}
