import Image from "next/image";
import Link from "next/link";
import { CopyCode } from "@/components/copy-code";
import { HeroSearch } from "@/components/hero-search";
import { LatestMemes } from "@/components/latest-memes";
import mascot from "@/public/brand/mascot.png";
import jeep from "@/public/brand/sticker-jeep.png";
import coffee from "@/public/brand/sticker-coffee.png";

const FEELINGS = ["pagod na sa Monday", "kilig sa chat ni crush", "sweldo pa lang, ubos na", "late na naman sa standup", "tita na judgy", "badtrip sa traffic", "puyat sa thesis", "gutom na pero petsa de peligro"];

const WAYS = [
  {
    n: "01",
    title: "Website",
    body: "Type a feeling in Taglish. Copy, download, or report any meme in one click.",
    code: "https://<your-site>/search?q=pagod+na+sa+monday",
  },
  {
    n: "02",
    title: "REST API",
    body: "Plain JSON with image URLs and full source credit. CORS is open for GET.",
    code: 'curl "https://<your-site>/api/search?q=late+na+naman+sa+standup&limit=5"',
  },
  {
    n: "03",
    title: "MCP server",
    body: "Codex, ChatGPT, or Claude search and generate memes mid-conversation.",
    code: "codex mcp add hanapmeme --url https://<your-site>/api/mcp",
  },
];

export default function Home() {
  return (
    <>
      {/* HERO: stacked giant type, content laid over the outlined word */}
      <section className="relative -mt-[88px] overflow-hidden pt-[88px]">
        <div aria-hidden className="pointer-events-none select-none">
          <p className="display -ml-[0.04em] whitespace-nowrap text-[clamp(96px,24vw,380px)] uppercase text-accent">Hanap</p>
          <p className="display outline-text -ml-[0.04em] -mt-[0.04em] whitespace-nowrap text-[clamp(96px,24vw,380px)] uppercase">Meme</p>
        </div>

        <div className="absolute right-2 top-[60px] z-10 flex h-24 w-24 rotate-12 items-center justify-center rounded-full bg-hot p-3 text-center text-[11px] sm:right-[4%] sm:top-[110px] sm:h-36 sm:w-36 sm:p-4 sm:text-[15px] font-extrabold uppercase leading-tight text-card-ink shadow-[0_12px_0_#000]">
          Taglish feelings only
        </div>

        <div className="relative z-10 mx-auto -mt-[clamp(80px,17vw,270px)] grid max-w-[1200px] gap-12 px-5 pb-20 sm:px-12 md:grid-cols-[1.1fr_0.9fr]">
          <div className="min-w-0 space-y-6">
            <span className="label inline-block bg-hot px-3 py-1.5 text-card-ink" style={{ letterSpacing: "0.1em" }}>
              Pinoy meme search engine
            </span>
            <p className="-ml-3 max-w-md bg-background p-3 text-lg font-medium leading-relaxed">
              It is Google for Pinoy memes, but you search in Taglish feelings. Type the vibe. Get the meme. Credit included.
            </p>
            <HeroSearch />
            <div className="flex flex-wrap gap-3">
              <Link href="/search" className="btn btn-ghost">Browse the gallery</Link>
              <Link href="/generate" className="btn btn-ghost">Gumawa ng meme</Link>
            </div>
          </div>
          <div className="relative mx-auto w-full max-w-sm">
            <div className="slab rotate-3 p-6">
              <Image src={mascot} alt="HanapMeme mascot: a cheeky magnifying glass wearing a salakot" priority className="h-auto w-full" />
              <p className="label mt-3 text-center !tracking-[0.2em]">Hanap. Tawa. Share.</p>
            </div>
            <Image src={coffee} alt="" aria-hidden className="absolute -bottom-10 -left-12 w-28 -rotate-12 sm:w-36" />
          </div>
        </div>
      </section>

      {/* MARQUEE of feelings */}
      <section aria-label="Popular searches" className="overflow-hidden border-y-2 border-line bg-accent py-4 text-accent-ink">
        <div className="marquee-track flex w-max gap-10">
          {[...FEELINGS, ...FEELINGS].map((f, i) => (
            <Link key={i} href={`/search?q=${encodeURIComponent(f)}`} className="display whitespace-nowrap text-3xl uppercase hover:text-hot sm:text-5xl" style={{ letterSpacing: "-0.03em" }} tabIndex={i >= FEELINGS.length ? -1 : 0}>
              {f} <span aria-hidden className="text-hot">✱</span>
            </Link>
          ))}
        </div>
      </section>

      {/* LIVE GALLERY */}
      <section className="mx-auto max-w-[1200px] px-5 py-20 sm:px-12">
        <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
          <h2 className="display text-[clamp(48px,9vw,120px)] uppercase">
            Bagong <span className="outline-text">memes</span>
          </h2>
          <Link href="/search" className="btn btn-primary">Tingnan lahat →</Link>
        </div>
        <LatestMemes />
      </section>

      {/* INTEGRATE */}
      <section id="integrate" className="scroll-mt-8 border-t-2 border-line">
        <div className="mx-auto max-w-[1200px] px-5 py-20 sm:px-12">
          <h2 className="display text-[clamp(48px,9vw,120px)] uppercase">
            3 ways <span className="text-hot">in.</span>
          </h2>
          <p className="mt-4 max-w-xl text-lg font-medium text-muted">Same search, same takedowns, everywhere. Report a meme once and it disappears from all three.</p>
          <div className="mt-12 grid gap-8 md:grid-cols-3">
            {WAYS.map((w, i) => (
              <article key={w.n} className="slab flex min-w-0 flex-col gap-4 p-6" style={{ rotate: `${(i - 1) * 1.2}deg` }}>
                <p className="display text-6xl text-hot">{w.n}</p>
                <h3 className="display text-3xl uppercase" style={{ letterSpacing: "-0.03em" }}>{w.title}</h3>
                <p className="font-medium">{w.body}</p>
                <div className="mt-auto"><CopyCode code={w.code} /></div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* GENERATE CTA */}
      <section className="relative overflow-hidden bg-hot text-card-ink">
        <div className="mx-auto grid max-w-[1200px] items-center gap-8 px-5 py-20 sm:px-12 md:grid-cols-[1fr_auto]">
          <div>
            <h2 className="display text-[clamp(44px,8vw,110px)] uppercase">Walang meme? Gumawa ka.</h2>
            <p className="mt-4 max-w-lg text-lg font-semibold">Describe the situation. AI picks an original template and writes the Taglish captions. Every result is labeled AI-generated.</p>
            <Link href="/generate" className="btn mt-8 bg-card-ink text-foreground">Gawa na →</Link>
          </div>
          <Image src={jeep} alt="" aria-hidden className="w-56 -rotate-6 sm:w-72" />
        </div>
      </section>
    </>
  );
}
