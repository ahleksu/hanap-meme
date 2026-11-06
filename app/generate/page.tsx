"use client";
import { useState } from "react";

export default function GeneratePage() {
  const [situation, setSituation] = useState("");
  const [img, setImg] = useState<{ url: string; top: string; bottom: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ situation }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? res.statusText);
      setImg({
        url: URL.createObjectURL(await res.blob()),
        top: decodeURIComponent(res.headers.get("X-Caption-Top") ?? ""),
        bottom: decodeURIComponent(res.headers.get("X-Caption-Bottom") ?? ""),
      });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-[1200px] px-5 pb-20 sm:px-12">
      <h1 className="display text-[clamp(56px,12vw,170px)] uppercase text-accent">Gawa<span className="outline-text"> ng meme</span></h1>
      <p className="mt-6 max-w-xl text-lg font-medium">Describe the situation. HanapMeme picks an original AI template and writes Taglish captions.</p>
      <form onSubmit={submit} className="mt-8 max-w-2xl space-y-4">
        <label htmlFor="situation" className="sr-only">Situation</label>
        <textarea
          id="situation"
          value={situation}
          onChange={(e) => setSituation(e.target.value)}
          placeholder="na-late ulit ako sa standup kasi baha sa España"
          rows={3}
          className="w-full bg-card p-5 text-lg font-medium text-card-ink placeholder:text-card-ink/50 outline-none focus:shadow-[6px_6px_0_var(--hot)]"
        />
        <button disabled={loading || !situation.trim()} className="btn btn-primary disabled:opacity-50">
          {loading ? "Ginagawa…" : "Generate →"}
        </button>
      </form>
      {error && <p role="alert" className="label mt-4 text-hot">{error}</p>}
      {img && (
        <figure className="mt-12 max-w-2xl space-y-5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={img.url} alt={`${img.top} / ${img.bottom}`} className="slab w-full -rotate-1" />
          <a href={img.url} download="hanapmeme-generated.png" className="btn btn-ghost">
            Download PNG
          </a>
        </figure>
      )}
    </div>
  );
}
