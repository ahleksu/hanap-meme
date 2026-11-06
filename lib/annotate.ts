import { z } from "zod";
import { zodTextFormat } from "openai/helpers/zod";
import { getOpenAI, TEXT_MODEL } from "./openai";

export const Annotation = z.object({
  description_tl: z.string().describe("1-2 sentences in natural Taglish: what the meme shows and when Filipinos would use it"),
  description_en: z.string().describe("1-2 sentences in English with the same meaning"),
  ocr_text: z.string().describe("All visible text in the image, verbatim. Empty string if none."),
  tags_emotion: z.array(z.string()).describe("3-6 lowercase feelings in Tagalog and English, e.g. pagod, tired, kilig, badtrip"),
  tags_situation: z.array(z.string()).describe("3-6 lowercase situations, e.g. monday, standup, sweldo, traffic, exam"),
  format: z.enum(["reaction", "two_panel", "quote_card", "template"]),
  language: z.string().describe("tl, en, taglish, or none"),
  flags: z.object({
    possible_minor: z.boolean().describe("true if anyone shown could be under 18"),
    private_individual: z.boolean().describe("true if a real person who is not a public figure or a widely known meme subject is identifiable"),
    explicit: z.boolean(),
    hateful: z.boolean(),
  }),
});
export type Annotation = z.infer<typeof Annotation>;

const PROMPT = `You catalog memes for a Filipino meme search engine. Describe the image so people can find it by searching in Taglish feelings and situations.
Be conservative with flags: if unsure whether a person is a minor or a private individual, set the flag to true.
Context from the source (may be empty): `;

export async function annotateImage(webp: Buffer, context: string): Promise<Annotation | null> {
  const ai = getOpenAI();
  if (!ai) return null;
  const res = await ai.responses.parse(
    {
      model: TEXT_MODEL,
      reasoning: { effort: "low" },
      input: [
        {
          role: "user",
          content: [
            { type: "input_text", text: PROMPT + context },
            { type: "input_image", image_url: `data:image/webp;base64,${webp.toString("base64")}`, detail: "low" },
          ],
        },
      ],
      text: { format: zodTextFormat(Annotation, "meme_annotation") },
    },
    { timeout: 60_000 },
  );
  return res.output_parsed;
}
