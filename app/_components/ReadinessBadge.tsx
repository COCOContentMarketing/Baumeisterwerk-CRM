import type { Readiness } from "@/lib/recommendations/readiness";

const STYLES: Record<Readiness, string> = {
  bereit: "bg-emerald-100 text-emerald-900",
  recherche: "bg-amber-100 text-amber-900",
  wartend: "bg-slate-200 text-slate-700",
};

const LABELS: Record<Readiness, string> = {
  bereit: "Bereit",
  recherche: "Recherche nötig",
  wartend: "Wartend",
};

export function ReadinessBadge({
  readiness,
  snoozedUntil,
}: {
  readiness: Readiness;
  snoozedUntil?: string | null;
}) {
  const label =
    readiness === "wartend" && snoozedUntil
      ? `Wartend bis ${formatShortDate(snoozedUntil)}`
      : LABELS[readiness];
  return <span className={`chip ${STYLES[readiness]}`}>{label}</span>;
}

function formatShortDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "2-digit" });
}
