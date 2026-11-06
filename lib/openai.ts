import OpenAI from "openai";

// Model IDs checked against developers.openai.com on 2026-11-06. See README "How OpenAI is used".
export const TEXT_MODEL = process.env.OPENAI_TEXT_MODEL || "gpt-6.1-sol";
export const EMBED_MODEL = process.env.OPENAI_EMBED_MODEL || "text-embedding-3-small";
export const IMAGE_MODEL = process.env.OPENAI_IMAGE_MODEL || "gpt-image-2";

let client: OpenAI | null | undefined;

/** Returns null when no key is set, so every caller has a no-key path. */
export function getOpenAI(): OpenAI | null {
  if (client !== undefined) return client;
  const key = process.env.OPENAI_API_KEY;
  client = key && !key.startsWith("sk-your") ? new OpenAI({ apiKey: key, maxRetries: 1 }) : null;
  return client;
}

export async function embed(texts: string[], timeoutMs = 10_000): Promise<number[][] | null> {
  const ai = getOpenAI();
  if (!ai) return null;
  try {
    const res = await ai.embeddings.create(
      { model: EMBED_MODEL, input: texts, encoding_format: "float" },
      { timeout: timeoutMs },
    );
    return res.data.map((d) => d.embedding);
  } catch (e) {
    console.warn("[openai] embed failed:", (e as Error).message);
    return null;
  }
}
