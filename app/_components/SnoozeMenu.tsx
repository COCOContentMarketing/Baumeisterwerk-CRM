"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { snoozeRecommendation, unsnoozeRecommendation } from "@/lib/db/mutations";

interface SnoozePreset {
  label: string;
  days: number;
}

const PRESETS: SnoozePreset[] = [
  { label: "+1 Tag", days: 1 },
  { label: "+3 Tage", days: 3 },
  { label: "+7 Tage", days: 7 },
  { label: "+14 Tage", days: 14 },
];

function addDays(days: number): string {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

export function SnoozeMenu({
  recommendationId,
  snoozedUntil,
}: {
  recommendationId: string;
  snoozedUntil: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [showCustom, setShowCustom] = useState(false);

  const active = isInFuture(snoozedUntil);

  function snooze(iso: string) {
    setOpen(false);
    setShowCustom(false);
    startTransition(async () => {
      await snoozeRecommendation(recommendationId, iso);
      router.refresh();
    });
  }

  function unsnooze() {
    setOpen(false);
    startTransition(async () => {
      await unsnoozeRecommendation(recommendationId);
      router.refresh();
    });
  }

  function submitCustom(formData: FormData) {
    const raw = String(formData.get("custom_date") ?? "").trim();
    if (!raw) return;
    // Datum aus dem <input type="date"> liegt als YYYY-MM-DD vor. Wir
    // wandeln es taggleich in einen Zeitpunkt um (lokale Zeit, Mittag,
    // damit Zeitzonen-Sprung das Datum nicht versehentlich verschiebt).
    const local = new Date(`${raw}T12:00:00`);
    if (Number.isNaN(local.getTime())) return;
    snooze(local.toISOString());
  }

  if (active) {
    return (
      <button
        type="button"
        onClick={unsnooze}
        disabled={pending}
        className="text-xs font-medium text-brand-700 hover:underline"
        title="Snooze aufheben - Empfehlung wieder als bereit anzeigen"
      >
        Wieder aufwecken
      </button>
    );
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={pending}
        className="text-xs font-medium text-brand-700 hover:underline"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        Snooze ▾
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 z-10 mt-1 w-44 rounded-md border border-brand-200 bg-white p-1 text-sm shadow-md"
        >
          {PRESETS.map((p) => (
            <button
              key={p.days}
              type="button"
              role="menuitem"
              onClick={() => snooze(addDays(p.days))}
              disabled={pending}
              className="block w-full rounded px-2 py-1 text-left hover:bg-brand-50"
            >
              {p.label}
            </button>
          ))}
          <div className="my-1 border-t border-brand-100" />
          {showCustom ? (
            <form action={submitCustom} className="space-y-2 p-2">
              <input
                type="date"
                name="custom_date"
                required
                min={new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10)}
                className="input text-xs"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCustom(false)}
                  className="text-xs text-brand-500"
                >
                  Abbrechen
                </button>
                <button type="submit" disabled={pending} className="btn-primary px-2 py-1 text-xs">
                  OK
                </button>
              </div>
            </form>
          ) : (
            <button
              type="button"
              role="menuitem"
              onClick={() => setShowCustom(true)}
              className="block w-full rounded px-2 py-1 text-left hover:bg-brand-50"
            >
              Eigenes Datum…
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function isInFuture(iso: string | null): boolean {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  return !Number.isNaN(t) && t > Date.now();
}
