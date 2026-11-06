"use client";
import { useCallback, useRef, useState } from "react";

export function useToast() {
  const [msg, setMsg] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const show = useCallback((m: string) => {
    setMsg(m);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setMsg(null), 2500);
  }, []);
  const node = msg ? (
    <div role="status" className="label fixed bottom-6 left-1/2 z-50 -translate-x-1/2 -rotate-2 bg-hot px-5 py-3 text-card-ink shadow-[6px_6px_0_var(--accent)]">
      {msg}
    </div>
  ) : null;
  return { show, node };
}
