import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getActive } from "./db";
import { generateMeme } from "./generate";
import { memeImage } from "./images";
import { searchMemes } from "./search";
import type { Meme } from "./types";

function credit(m: Meme, site: string) {
  const who = m.original_author ? ` · Author: ${m.original_author}` : "";
  const lines = [
    `id: ${m.id}`,
    `description: ${m.description_tl || m.description_en}`,
    m.description_tl && m.description_en ? `english: ${m.description_en}` : "",
    m.ocr_text ? `text in image: ${m.ocr_text}` : "",
    `source: ${m.source_platform} · ${m.source_url}${who}`,
    `rights_status: ${m.rights_status}`,
    m.rights_status === "unverified" ? `Rights unverified. Source: ${m.source_url} · Report: ${site}/takedown?id=${m.id}` : "",
  ];
  return lines.filter(Boolean).join("\n");
}

async function imageBlock(m: Meme, max: number) {
  const { data, mimeType } = await memeImage(m, max);
  return { type: "image" as const, data: data.toString("base64"), mimeType };
}

export function createMcpServer(site: string) {
  const server = new McpServer({ name: "hanapmeme", version: "0.1.0" });

  server.registerTool(
    "search_memes",
    {
      title: "Search Filipino memes",
      description:
        "Search Filipino memes by feeling or situation in Taglish, Tagalog, or English, e.g. 'late na naman sa standup' or 'pagod na sa Monday'. Returns thumbnails with source credit.",
      inputSchema: { query: z.string().min(1).max(200), limit: z.number().int().min(1).max(10).optional() },
      annotations: { readOnlyHint: true },
    },
    async ({ query, limit }) => {
      const { mode, memes } = await searchMemes(query, limit ?? 5);
      if (!memes.length) return { content: [{ type: "text", text: `Walang nahanap para sa "${query}".` }] };
      const content: ({ type: "text"; text: string } | Awaited<ReturnType<typeof imageBlock>>)[] = [
        { type: "text", text: `${memes.length} memes for "${query}" (${mode} search)` },
      ];
      for (const m of memes) content.push({ type: "text", text: credit(m, site) }, await imageBlock(m, 512));
      return { content };
    },
  );

  server.registerTool(
    "get_meme",
    {
      title: "Get one meme",
      description: "Get the full-size image and full provenance of a meme by id.",
      inputSchema: { id: z.string().min(1).max(64) },
      annotations: { readOnlyHint: true },
    },
    async ({ id }) => {
      const m = await getActive(id);
      if (!m) return { content: [{ type: "text", text: `No active meme with id ${id}.` }], isError: true };
      const prov = `${credit(m, site)}\nplatform: ${m.source_platform}\nretrieved_at: ${m.retrieved_at}\nformat: ${m.format}\ntags: ${[...m.tags_emotion, ...m.tags_situation].join(", ")}`;
      return { content: [{ type: "text", text: prov }, await imageBlock(m, 1024)] };
    },
  );

  server.registerTool(
    "generate_meme",
    {
      title: "Generate a meme",
      description: "Make a new Taglish meme for a situation on an original AI-generated template. Returns a PNG and the captions.",
      inputSchema: { situation: z.string().min(1).max(300) },
    },
    async ({ situation }) => {
      const g = await generateMeme(situation);
      return {
        content: [
          { type: "text", text: `top: ${g.top}\nbottom: ${g.bottom}\ntemplate: ${g.templateId ?? "none"}\nrights_status: ai_generated (AI-generated · HanapMeme)` },
          { type: "image", data: g.png.toString("base64"), mimeType: "image/png" },
        ],
      };
    },
  );

  return server;
}
