import "./env";
import fs from "node:fs";
import path from "node:path";
import { createCanvas, loadImage } from "@napi-rs/canvas";
import { getOpenAI, IMAGE_MODEL } from "../lib/openai";
import { TEMPLATE_DIR, type Template } from "../lib/generate";

const STYLE =
  "Photorealistic meme reaction template background. The person is fictional, an adult, not resembling any real person or celebrity. No text, no letters, no captions, no logos, no brand names, no watermarks. Leave empty space at the top and bottom for captions.";

const TEMPLATES: Omit<Template, "file">[] = [
  { id: "judgy-tita", title: "Judgy tita sipping coffee", situations: ["tita", "chismis", "judge", "family", "reunion", "marites"], prompt: "A Filipino middle-aged aunt sitting at a dining table, sipping coffee from a mug, giving a side-eye judgmental look." },
  { id: "empty-ewallet", title: "Office worker staring at empty e-wallet", situations: ["sweldo", "pera", "broke", "payday", "budget", "petsa"], prompt: "A young Filipino office worker in a cubicle staring in disbelief at a phone screen showing an empty wallet balance, generic app with no logos." },
  { id: "jeepney-rain", title: "Commuter in the rain at a jeepney stop", situations: ["ulan", "commute", "traffic", "late", "baha", "pagod"], prompt: "A soaked commuter standing at a rainy street corner in Manila waiting for a jeepney, holding a broken umbrella, defeated expression. The jeepney has no signage." },
  { id: "student-3am", title: "Student at 3am with a laptop", situations: ["exam", "deadline", "puyat", "thesis", "study", "pagod"], prompt: "A tired college student at 3am in a dim bedroom lit by a laptop screen, messy hair, instant noodles on the desk." },
  { id: "late-standup", title: "Running late to the standup", situations: ["late", "standup", "meeting", "work", "huli", "monday"], prompt: "A panicked young professional running into an office holding a coffee cup and a laptop, clock on the wall." },
  { id: "kilig-phone", title: "Kilig over a text message", situations: ["kilig", "crush", "jowa", "sweet", "landi", "love"], prompt: "A young adult lying on a bed hugging a pillow, smiling widely at a phone, cheeks blushing." },
  { id: "badtrip-traffic", title: "Badtrip driver in EDSA traffic", situations: ["badtrip", "traffic", "galit", "pikon", "inis", "commute"], prompt: "A frustrated driver gripping the steering wheel in heavy city traffic at dusk, red brake lights everywhere." },
  { id: "monday-zombie", title: "Monday morning zombie", situations: ["monday", "pagod", "antok", "work", "lunes", "tired"], prompt: "An exhausted office worker slumped at a desk on a Monday morning with dark eye bags, holding a huge mug of coffee." },
];

async function main() {
  const ai = getOpenAI();
  fs.mkdirSync(TEMPLATE_DIR, { recursive: true });
  const manifest: Template[] = [];
  for (const t of TEMPLATES.slice(0, 8)) {
    const file = `${t.id}.webp`;
    const out = path.join(TEMPLATE_DIR, file);
    if (fs.existsSync(out)) {
      console.log(`skip ${t.id} (exists)`);
      manifest.push({ ...t, file });
      continue;
    }
    if (!ai) {
      console.log(`skip ${t.id}: OPENAI_API_KEY not set`);
      continue;
    }
    try {
      console.log(`generating ${t.id} with ${IMAGE_MODEL}…`);
      const res = await ai.images.generate(
        { model: IMAGE_MODEL, prompt: `${t.prompt} ${STYLE}`, size: "1024x1024", quality: "medium", n: 1 },
        { timeout: 180_000 },
      );
      const b64 = res.data?.[0]?.b64_json;
      if (!b64) throw new Error("no image in response");
      const img = await loadImage(Buffer.from(b64, "base64"));
      const canvas = createCanvas(img.width, img.height);
      canvas.getContext("2d").drawImage(img, 0, 0);
      fs.writeFileSync(out, await canvas.encode("webp", 85));
      manifest.push({ ...t, file });
    } catch (e) {
      console.log(`fail ${t.id}: ${(e as Error).message}`);
    }
  }
  fs.writeFileSync(
    path.join(TEMPLATE_DIR, "manifest.json"),
    JSON.stringify(
      {
        note: "Original AI-generated backgrounds of fictional people. rights_status ai_generated, format template.",
        model: IMAGE_MODEL,
        templates: manifest.map((t) => ({ ...t, rights_status: "ai_generated", format: "template" })),
      },
      null,
      2,
    ) + "\n",
  );
  console.log(`manifest.json: ${manifest.length} templates`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
