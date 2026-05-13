"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

interface SyncResponse {
  fetched: number;
  inserted: number;
  classifiedOk: number;
  classifiedFailed: number;
  bouncesProcessed: number;
  unknownSenders: string[];
  recommendationsCreated: number;
  recommendationsUpdated: number;
  usedFallback: boolean;
  error?: string;
}

export function CheckInboxButton() {
  const [pending, startTransition] = useTransition();
  const [toast, setToast] = useState<string | null>(null);
  const router = useRouter();

  function trigger() {
    setToast(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/inbox/sync", { method: "POST" });
        const json = (await res.json()) as SyncResponse;
        if (!res.ok) {
          setToast(json.error ?? "Sync fehlgeschlagen");
          return;
        }
        const parts: string[] = [];
        parts.push(`${json.inserted} neue Mails`);
        if (json.recommendationsCreated > 0)
          parts.push(`${json.recommendationsCreated} neue Empfehlungen`);
        if (json.bouncesProcessed > 0)
          parts.push(`${json.bouncesProcessed} Bounces`);
        if (json.unknownSenders.length > 0)
          parts.push(`${json.unknownSenders.length} unbekannte Absender`);
        if (parts.length === 0) parts.push("nichts neues");
        setToast(parts.join(" · "));
        router.refresh();
      } catch (e) {
        setToast(e instanceof Error ? e.message : "Sync fehlgeschlagen");
      }
    });
  }

  return (
    <div className="flex items-center gap-3">
      {toast && <span className="text-xs text-brand-500">{toast}</span>}
      <button onClick={trigger} disabled={pending} className="btn-secondary">
        {pending ? "Synchronisiere…" : "Posteingang pruefen"}
      </button>
    </div>
  );
}
