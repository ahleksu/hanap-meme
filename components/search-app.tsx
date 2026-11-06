"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import type { PublicMeme } from "@/lib/types";
import { DetailModal, MemeGrid } from "./meme-grid";
import { useToast } from "./toast";

export const CHIPS = ["late na naman sa standup", "pagod na sa Monday", "sweldo pa lang, ubos na", "kilig sa chat ni crush", "tita na judgy"];
const TABS = [
  ["all", "Lahat"],
  ["gif", "GIFs"],
  ["meme", "Memes"],
  ["template", "Templates"],
] as const;
type Tab = (typeof TABS)[number][0];

type Results = { mode: string; results: PublicMeme[] };

export function SearchApp() {
  const params = useSearchParams();
  const router = useRouter();
  const initial = params.get("q") ?? "";
  const [q, setQ] = useState(initial);
  const [data, setData] = useState<Results | null>(null);
  const [loading, setLoading] = useState(true);
  const [libraryEmpty, setLibraryEmpty] = useState(false);
  const [tab, setTab] = useState<Tab>("all");
  const [open, setOpen] = useState<PublicMeme | null>(null);
  const toast = useToast();

  async function run(query: string) {
    setLoading(true);
    router.replace(query ? `/search?q=${encodeURIComponent(query)}` : "/search", { scroll: false });
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(query)}&limit=48`);
      const json = (await res.json()) as Results;
      setData(json);
      if (!query) setLibraryEmpty(json.results.length === 0);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    run(initial);
    // Run once for the query in the URL; later searches go through the form.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function report(m: PublicMeme) {
    const res = await fetch("/api/report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: m.id, reason: "Reported from the website card" }),
    });
    if (!res.ok) return toast.show("Hindi ma-report ngayon. Subukan ulit.");
    setData((d) => d && { ...d, results: d.results.filter((x) => x.id !== m.id) });
    setOpen(null);
    toast.show("Salamat. Tinanggal na.");
  }

  const shown = (data?.results ?? []).filter((m) =>
    tab === "all" ? true : tab === "gif" ? m.animated : tab === "template" ? m.format === "template" : !m.animated && m.format !== "template",
  );

  return (
    <div>
      <div className="sticky top-0 z-30 border-b-2 border-line bg-background/95 backdrop-blur">
        <div className="mx-auto max-w-[1200px] px-5 py-5 sm:px-12">
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              run(q);
            }}
          >
            <label htmlFor="q" className="sr-only">Search memes</label>
            <input
              id="q"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="meme para sa late na naman sa standup"
              className="min-w-0 flex-1 bg-card px-5 py-4 text-lg font-medium text-card-ink placeholder:text-card-ink/50 outline-none focus:shadow-[6px_6px_0_var(--hot)]"
            />
            <button className="btn btn-primary" disabled={loading}>
              {loading ? "Hinahanap…" : "Hanap →"}
            </button>
          </form>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {CHIPS.map((c) => (
              <button
                key={c}
                onClick={() => {
                  setQ(c);
                  run(c);
                }}
                className="label border-2 border-line px-3 py-1.5 !text-[11px] hover:bg-accent hover:text-accent-ink hover:border-accent"
              >
                {c}
              </button>
            ))}
          </div>
        </div>
      </div>

      <section className="mx-auto max-w-[1200px] px-5 py-8 sm:px-12">
        <div className="mb-5 flex flex-wrap items-center gap-2">
          {TABS.map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              aria-pressed={tab === key}
              className={`label px-4 py-2 ${tab === key ? "bg-hot text-card-ink" : "border-2 border-line hover:text-accent"}`}
            >
              {label}
            </button>
          ))}
          {data && (
            <p className="label ml-auto text-muted">
              {shown.length} {data.results.length && q ? `results for “${q}” · ${data.mode} search` : "memes"}
            </p>
          )}
        </div>

        {libraryEmpty ? (
          <p className="slab mx-auto max-w-xl -rotate-1 p-8 text-center text-lg font-medium">
            Wala pang memes. Run <code className="font-mono font-bold">npm run ingest</code> or drop images into{" "}
            <code className="font-mono font-bold">data/inbox/</code>.
          </p>
        ) : data && shown.length === 0 && !loading ? (
          <p className="py-16 text-center">
            <span className="display outline-text block text-[clamp(56px,12vw,160px)] uppercase">Wala.</span>
            <span className="mt-6 block text-lg text-muted">Walang nahanap. Try another feeling, or <a href="/generate" className="text-accent underline">gumawa ng sariling meme</a>.</span>
          </p>
        ) : !data ? (
          <div aria-busy="true" aria-label="Loading memes" className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 8 }, (_, i) => <div key={i} className="aspect-[4/5] animate-pulse bg-foreground/10" />)}
          </div>
        ) : (
          <div className={loading ? "opacity-40 transition-opacity" : "transition-opacity"} aria-busy={loading}>
            <MemeGrid memes={shown} onOpen={setOpen} onReport={report} toast={toast.show} />
          </div>
        )}
      </section>

      {open && <DetailModal m={open} onClose={() => setOpen(null)} onReport={() => report(open)} />}
      {toast.node}
    </div>
  );
}
