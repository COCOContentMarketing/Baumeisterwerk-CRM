// Sichtbarer Hinweis, dass die Email-Adresse eines Kontakts als ungueltig
// markiert ist (i.d.R. nach einem Bounce-Sync). Tooltip zeigt den
// gespeicherten Grund. Wird in Listen UND auf Detailseiten verwendet.
export function BounceBadge({
  reason,
  since,
  compact = false,
}: {
  reason?: string | null;
  since?: string | null;
  compact?: boolean;
}) {
  const tip = [reason, since ? `seit ${formatShortDate(since)}` : null]
    .filter(Boolean)
    .join(" · ");
  if (compact) {
    return (
      <span
        title={tip || "Bounce empfangen"}
        className="inline-block text-rose-700"
        aria-label="Email ungültig"
      >
        ⚠
      </span>
    );
  }
  return (
    <span
      title={tip || "Bounce empfangen"}
      className="chip bg-rose-100 text-rose-900"
    >
      ⚠ Email ungültig
    </span>
  );
}

function formatShortDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "2-digit" });
}
