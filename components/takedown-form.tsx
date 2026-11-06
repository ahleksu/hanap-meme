"use client";
import { useSearchParams } from "next/navigation";
import { useState } from "react";

export function TakedownForm() {
  const params = useSearchParams();
  const [id, setId] = useState(params.get("id") ?? "");
  const [reason, setReason] = useState("");
  const [result, setResult] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: id.trim(), reason }),
    });
    setResult(res.ok ? "Salamat. Tinanggal na." : res.status === 404 ? "No active meme with that id. It may already be removed." : "Something went wrong. Please try again.");
  }

  const field = "mt-2 w-full bg-card p-4 font-medium text-card-ink outline-none focus:shadow-[6px_6px_0_var(--hot)]";
  return (
    <form onSubmit={submit} className="mt-8 max-w-xl space-y-5">
      <div>
        <label htmlFor="id" className="label">Meme id</label>
        <input id="id" required value={id} onChange={(e) => setId(e.target.value)} className={field} />
      </div>
      <div>
        <label htmlFor="reason" className="label">Reason</label>
        <textarea id="reason" required rows={4} value={reason} onChange={(e) => setReason(e.target.value)} className={field} placeholder="I am the creator / this shows me / this is harmful" />
      </div>
      <button className="btn bg-hot text-card-ink">Remove this meme →</button>
      {result && <p role="status" className="label text-accent">{result}</p>}
    </form>
  );
}
