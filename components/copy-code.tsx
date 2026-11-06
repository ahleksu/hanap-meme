"use client";
import { useState } from "react";

export function CopyCode({ code }: { code: string }) {
  const [done, setDone] = useState(false);
  return (
    <div className="relative">
      <pre className="overflow-x-auto bg-card-ink p-4 pr-20 font-mono text-[13px] leading-relaxed text-foreground">
        <code>{code}</code>
      </pre>
      <button
        onClick={() => navigator.clipboard.writeText(code).then(() => { setDone(true); setTimeout(() => setDone(false), 1500); })}
        className="label absolute right-2 top-2 bg-accent px-2 py-1 !text-[11px] text-accent-ink"
      >
        {done ? "Copied" : "Copy"}
      </button>
    </div>
  );
}
