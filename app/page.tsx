import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { PriorityBadge } from "@/components/PriorityBadge";
import { DbErrorBanner } from "@/components/DbErrorBanner";
import { listCompanies, listOpenRecommendations } from "@/lib/db/queries";
import { safeRun } from "@/lib/db/safe";
import { formatRelative } from "@/lib/format";
import {
  classifyReadiness,
  parseReadinessView,
  readinessCounts,
  type ReadinessView,
} from "@/lib/recommendations/readiness";
import { GenerateRecommendationsButton } from "./_components/GenerateRecommendationsButton";
import { CheckInboxButton } from "./_components/CheckInboxButton";
import { ReadinessBadge } from "./_components/ReadinessBadge";
import { BounceBadge } from "./_components/BounceBadge";
import { SnoozeMenu } from "./_components/SnoozeMenu";

export const dynamic = "force-dynamic";

const VIEW_LABELS: Record<ReadinessView, string> = {
  alle: "Alle",
  bereit: "Bereit",
  recherche: "Recherche nötig",
  wartend: "Wartend",
};

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ ready?: string }>;
}) {
  const [recsRes, companiesRes, sp] = await Promise.all([
    safeRun("listOpenRecommendations", listOpenRecommendations),
    safeRun("listCompanies", listCompanies),
    searchParams,
  ]);
  const view = parseReadinessView(sp.ready);
  const companies = companiesRes.ok ? companiesRes.data : [];
  const recs = recsRes.ok ? recsRes.data : [];
  const now = new Date();

  // Readiness fuer alle Recos vorab klassifizieren - daraus speisen sich
  // sowohl die Zaehler-Chips als auch die gefilterte Liste.
  const annotated = recs.map((r) => ({
    rec: r,
    readiness: classifyReadiness({
      recommendation: r,
      contact: r.contact,
      now,
    }),
  }));
  const counts = readinessCounts(annotated);
  const visible =
    view === "alle" ? annotated : annotated.filter((a) => a.readiness === view);

  const stats = {
    total: companies.length,
    leads: companies.filter((c) => c.status === "lead").length,
    inGespraech: companies.filter((c) => c.status === "in_gespraech").length,
    kunden: companies.filter((c) => c.status === "kunde").length,
  };

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle="Was als Nächstes ansteht."
        actions={
          <div className="flex items-center gap-2">
            <CheckInboxButton />
            <GenerateRecommendationsButton />
          </div>
        }
      />

      {!companiesRes.ok && <DbErrorBanner area="Unternehmen" message={companiesRes.error} />}
      {!recsRes.ok && <DbErrorBanner area="Empfehlungen" message={recsRes.error} />}

      <div className="mb-8 grid grid-cols-4 gap-4">
        <Stat label="Unternehmen" value={stats.total} />
        <Stat label="Leads" value={stats.leads} />
        <Stat label="In Gespräch" value={stats.inGespraech} />
        <Stat label="Kunden" value={stats.kunden} />
      </div>

      <h2 className="mb-3 text-lg font-semibold text-brand-900">Empfohlene nächste Schritte</h2>

      <div className="mb-3 flex flex-wrap gap-2">
        {(Object.keys(VIEW_LABELS) as ReadinessView[]).map((v) => {
          const active = v === view;
          const href = v === "bereit" ? "/" : `/?ready=${v}`;
          return (
            <Link
              key={v}
              href={href}
              className={`chip ${active ? "bg-brand-900 text-white" : "bg-brand-100 text-brand-900 hover:bg-brand-200"}`}
            >
              {VIEW_LABELS[v]} · {counts[v]}
            </Link>
          );
        })}
      </div>

      {visible.length === 0 ? (
        <div className="card p-6 text-center text-sm text-brand-500">
          {emptyMessage(view, recsRes.ok, recs.length)}
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map(({ rec: r, readiness }) => (
            <article
              key={r.id}
              className="card flex items-center justify-between gap-4 p-4 hover:border-brand-500"
            >
              <Link href={`/recommendations/${r.id}`} className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="chip bg-brand-100 text-brand-900">{r.kind}</span>
                  <PriorityBadge priority={r.priority} />
                  <ReadinessBadge readiness={readiness} snoozedUntil={r.snoozed_until} />
                  {r.contact?.email_invalid && (
                    <BounceBadge
                      reason={r.contact.email_invalid_reason}
                      since={r.contact.email_invalid_since}
                    />
                  )}
                  {r.due_at && (
                    <span className="text-xs text-brand-500">fällig {formatRelative(r.due_at)}</span>
                  )}
                </div>
                <div className="mt-1 truncate text-sm font-medium text-brand-900">{r.title}</div>
                <div className="text-xs text-brand-500">
                  {r.company?.name}
                  {r.contact?.full_name ? ` · ${r.contact.full_name}` : ""}
                </div>
              </Link>
              <div className="flex shrink-0 items-center gap-3">
                <SnoozeMenu recommendationId={r.id} snoozedUntil={r.snoozed_until} />
                <Link href={`/recommendations/${r.id}`} className="text-sm text-brand-500" aria-label="Öffnen">
                  →
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function emptyMessage(view: ReadinessView, ok: boolean, totalRecs: number): string {
  if (!ok) return "Empfehlungen konnten nicht geladen werden.";
  if (totalRecs === 0) return "Keine offenen Empfehlungen. Klicke oben rechts auf Empfehlungen generieren.";
  switch (view) {
    case "bereit":
      return "Keine bereiten Empfehlungen. Wechsle zu Recherche nötig oder Wartend.";
    case "recherche":
      return "Nichts zu recherchieren – alle offenen Empfehlungen sind bereit oder warten.";
    case "wartend":
      return "Keine Empfehlung ist aktuell gesnoozed.";
    case "alle":
      return "Keine offenen Empfehlungen.";
  }
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="card p-4">
      <div className="text-xs uppercase tracking-wide text-brand-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-brand-900">{value}</div>
    </div>
  );
}
