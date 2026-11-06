export type RightsStatus = "unverified" | "own" | "ai_generated";
export type MemeFormat = "reaction" | "two_panel" | "quote_card" | "template";
export type MemeStatus = "active" | "excluded" | "takedown";

export type Flags = {
  possible_minor: boolean;
  private_individual: boolean;
  explicit: boolean;
  hateful: boolean;
};

export type Meme = {
  id: string;
  file: string;
  sha256: string;
  width: number;
  height: number;
  source_url: string;
  source_platform: string;
  original_author: string | null;
  retrieved_at: string;
  rights_status: RightsStatus;
  description_tl: string;
  description_en: string;
  ocr_text: string;
  tags_emotion: string[];
  tags_situation: string[];
  format: MemeFormat;
  language: string;
  flags: Flags;
  status: MemeStatus;
};

/** The shape that leaves the server: no file path, no embedding, no sha. */
export type PublicMeme = Omit<Meme, "file" | "sha256" | "flags" | "status"> & {
  image_url: string;
  animated: boolean;
};

export function toPublic(m: Meme): PublicMeme {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { file, sha256, flags, status, ...rest } = m;
  return { ...rest, image_url: `/api/memes/${m.id}/image`, animated: file.endsWith(".gif") };
}
