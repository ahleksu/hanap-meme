"use client";
import { useEffect } from "react";
import type { PublicMeme } from "@/lib/types";

async function copyImage(url: string) {
  // Clipboards accept PNG, so the image is redrawn as PNG first (GIFs copy their first frame).
  const blob = await (await fetch(url)).blob();
  const bmp = await createImageBitmap(blob);
  const canvas = document.createElement("canvas");
  canvas.width = bmp.width;
  canvas.height = bmp.height;
  canvas.getContext("2d")!.drawImage(bmp, 0, 0);
  const png = await new Promise<Blob>((r) => canvas.toBlob((b) => r(b!), "image/png"));
  await navigator.clipboard.write([new ClipboardItem({ "image/png": png })]);
}

function Credit({ m }: { m: PublicMeme }) {
  return (
    <a href={m.source_url} target="_blank" rel="noopener noreferrer nofollow" className="block truncate text-xs font-semibold opacity-70 hover:opacity-100 hover:underline">
      📍 {m.source_platform}
      {m.original_author ? ` · ${m.original_author}` : ""}
    </a>
  );
}

export function MemeGrid({
  memes,
  onReport,
  onOpen,
  toast,
}: {
  memes: PublicMeme[];
  onReport: (m: PublicMeme) => void;
  onOpen: (m: PublicMeme) => void;
  toast: (s: string) => void;
}) {
  const btn = "label border-2 border-card-ink px-2 py-1 !text-[11px] hover:bg-card-ink hover:text-card";
  return (
    <div className="columns-2 gap-4 sm:columns-3 lg:columns-4">
      {memes.map((m, i) => (
        <figure
          key={m.id}
          className="mb-6 break-inside-avoid bg-card text-card-ink transition-[box-shadow,rotate] hover:shadow-[8px_8px_0_var(--hot)]"
          style={{ rotate: `${(((i * 37) % 5) - 2) * 0.6}deg` }}
        >
          <button onClick={() => onOpen(m)} className="relative block w-full" aria-label={`Open details: ${m.description_en}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={m.image_url} alt={m.description_en || m.description_tl} width={m.width} height={m.height} loading="lazy" className="h-auto w-full" />
            <span className="absolute left-2 top-2 flex gap-1">
              {m.animated && <span className="label bg-hot px-2 py-0.5 !text-[11px] text-card-ink">GIF</span>}
              {m.rights_status === "ai_generated" && <span className="label bg-accent px-2 py-0.5 !text-[11px] text-accent-ink">AI-made</span>}
            </span>
          </button>
          <figcaption className="space-y-2 p-3">
            <p className="line-clamp-2 text-sm font-medium leading-snug">{m.description_tl || m.description_en}</p>
            <Credit m={m} />
            <div className="flex flex-wrap gap-1.5">
              <button className={btn} onClick={() => copyImage(m.image_url).then(() => toast("Copied! I-paste mo na."), () => toast("Copy failed. Use Download."))}>
                Copy
              </button>
              <a className={btn} href={m.image_url} download={`hanapmeme-${m.id}.${m.animated ? "gif" : "webp"}`}>
                Download
              </a>
              <button className={`${btn} !border-hot text-[#c4123f] hover:!bg-hot hover:!text-card-ink`} onClick={() => onReport(m)}>
                Report
              </button>
            </div>
          </figcaption>
        </figure>
      ))}
    </div>
  );
}

export function DetailModal({ m, onClose, onReport }: { m: PublicMeme; onClose: () => void; onReport: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const rows: [string, React.ReactNode][] = [
    ["Source", <a key="s" href={m.source_url} target="_blank" rel="noopener noreferrer nofollow" className="break-all font-semibold underline">{m.source_url}</a>],
    ["Platform", m.source_platform],
    ["Author", m.original_author ?? "Unknown"],
    ["Retrieved", new Date(m.retrieved_at).toLocaleString()],
    ["Rights", m.rights_status],
    ["Format", m.animated ? `${m.format} (animated GIF)` : m.format],
    ["Text in image", m.ocr_text || "None"],
    ["Tags", [...m.tags_emotion, ...m.tags_situation].join(", ") || "None"],
    ["ID", <code key="id" className="font-mono">{m.id}</code>],
  ];
  return (
    <div role="dialog" aria-modal="true" aria-label="Meme details" className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="slab grid max-h-[90vh] w-full max-w-4xl overflow-auto md:grid-cols-2" onClick={(e) => e.stopPropagation()}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={m.image_url} alt={m.description_en} className="h-auto w-full bg-black object-contain" />
        <div className="space-y-3 p-5 text-sm">
          <div className="flex items-start justify-between gap-4">
            <p className="font-semibold">{m.description_tl || m.description_en}</p>
            <button onClick={onClose} aria-label="Close" className="text-3xl leading-none">×</button>
          </div>
          {m.description_tl && <p className="opacity-70">{m.description_en}</p>}
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5">
            {rows.map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="label !text-[11px] opacity-60">{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
          <p className="border-2 border-card-ink p-3 text-xs">
            HanapMeme does not own this image. Rights stay with the creator. If it is yours or should not be here, report it.
          </p>
          <button onClick={onReport} className="btn bg-hot text-card-ink">
            Report and remove
          </button>
        </div>
      </div>
    </div>
  );
}
