"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function HeroSearch() {
  const router = useRouter();
  const [q, setQ] = useState("");
  return (
    <form
      className="flex max-w-xl flex-col gap-3 sm:flex-row"
      onSubmit={(e) => {
        e.preventDefault();
        router.push(q.trim() ? `/search?q=${encodeURIComponent(q.trim())}` : "/search");
      }}
    >
      <label htmlFor="hero-q" className="sr-only">Search memes in Taglish</label>
      <input
        id="hero-q"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="meme para sa late na naman sa standup"
        className="min-w-0 flex-1 bg-card px-5 py-4 font-medium text-card-ink placeholder:text-card-ink/50 outline-none focus:shadow-[6px_6px_0_var(--hot)]"
      />
      <button className="btn btn-primary justify-center">Hanap na →</button>
    </form>
  );
}
