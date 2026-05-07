"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function GenerateRecommendationsButton() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function trigger() {
    setError(null);
    startTransition(async () => {
      const res = await fetch("/api/recommendations/generate", { method: "POST" });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error ?? "Fehler beim Generieren");
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-3">
      {error && <span className="text-xs text-rose-600">{error}</span>}
      <button onClick={trigger} disabled={pending} className="btn-primary">
        {pending ? "Generiere…" : "Empfehlungen generieren"}
      </button>
    </div>
  );
}
