import fs from "node:fs";
import path from "node:path";

// Tiny Markdown subset (headings, bullets, links, inline code) so the page needs no extra dependency.
function inline(text: string) {
  const parts = text.split(/(\[[^\]]+\]\([^)]+\)|`[^`]+`)/g);
  return parts.map((p, i) => {
    const link = p.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (link) return <a key={i} href={link[2]} className="text-accent underline">{link[1]}</a>;
    if (/^`[^`]+`$/.test(p)) return <code key={i} className="font-mono">{p.slice(1, -1)}</code>;
    return p;
  });
}

export default function About() {
  const md = fs.readFileSync(path.join(/* turbopackIgnore: true */ process.cwd(), "ASSET_LICENSE.md"), "utf8");
  return (
    <article className="mx-auto max-w-[1200px] space-y-4 px-5 pb-20 text-lg leading-relaxed sm:px-12">
      {md.split("\n").map((line, i) => {
        if (line.startsWith("# ")) return <h1 key={i} className="display pb-6 text-[clamp(48px,10vw,140px)] uppercase text-accent">{inline(line.slice(2))}</h1>;
        if (line.startsWith("## ")) return <h2 key={i} className="label pt-6 !text-base text-hot">{inline(line.slice(3))}</h2>;
        if (line.startsWith("- ")) return <li key={i} className="ml-6 max-w-3xl list-[square] marker:text-accent">{inline(line.slice(2))}</li>;
        return line.trim() ? <p key={i} className="max-w-3xl">{inline(line)}</p> : null;
      })}
    </article>
  );
}
