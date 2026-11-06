"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { PublicMeme } from "@/lib/types";

export function LatestMemes() {
  const [memes, setMemes] = useState<PublicMeme[] | null>(null);
  useEffect(() => {
    fetch("/api/search?q=&limit=8")
      .then((r) => r.json())
      .then((j) => setMemes(j.results))
      .catch(() => setMemes([]));
  }, []);
  if (memes && !memes.length)
    return (
      <p className="slab -rotate-1 p-8 text-lg font-medium">
        Wala pang memes. Run <code className="font-mono font-bold">npm run ingest</code> or drop images into{" "}
        <code className="font-mono font-bold">data/inbox/</code>.
      </p>
    );
  return (
    <div className="grid grid-cols-2 gap-5 md:grid-cols-4">
      {(memes ?? Array.from({ length: 8 }, () => null)).map((m, i) =>
        m ? (
          <Link
            key={m.id}
            href={`/search?q=${encodeURIComponent(m.tags_situation[0] ?? m.tags_emotion[0] ?? "")}`}
            className="group relative block aspect-square overflow-hidden bg-card transition-[rotate,box-shadow] hover:-rotate-2 hover:shadow-[8px_8px_0_var(--accent)]"
            style={{ rotate: `${((i % 3) - 1) * 1.5}deg` }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={m.image_url} alt={m.description_en || m.description_tl} loading="lazy" className="h-full w-full object-cover" />
            {m.animated && <span className="label absolute left-2 top-2 bg-hot px-2 py-0.5 !text-[11px] text-card-ink">GIF</span>}
            <span className="label absolute inset-x-0 bottom-0 translate-y-full bg-accent p-2 !text-[11px] text-accent-ink transition-transform group-hover:translate-y-0">
              {m.tags_emotion.slice(0, 3).join(" · ") || m.description_en}
            </span>
          </Link>
        ) : (
          <div key={i} className="aspect-square animate-pulse bg-foreground/10" />
        ),
      )}
    </div>
  );
}
