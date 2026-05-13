import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { PriorityBadge } from "@/components/PriorityBadge";
import { DbErrorBanner } from "@/components/DbErrorBanner";
import { listCompanies, listOpenRecommendations } from "@/lib/db/queries";
import { safeRun } from "@/lib/db/safe";
import { formatRelative } from "@/lib/format";
import { GenerateRecommendationsButton } from "./_components/GenerateRecommendationsButton";
import { CheckInboxButton } from "./_components/CheckInboxButton";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [recsRes, companiesRes] = await Promise.all([
    safeRun("listOpenRecommendations", listOpenRecommendations),
    safeRun("listCompanies", listCompanies),
  ]);
  const companies = companiesRes.ok ? companiesRes.data : [];
  const recs = recsRes.ok ? recsRes.data : [];

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
      {recs.length === 0 ? (
        <div className="card p-6 text-center text-sm text-brand-500">
          {recsRes.ok
            ? "Keine offenen Empfehlungen. Klicke oben rechts auf Empfehlungen generieren."
            : "Empfehlungen konnten nicht geladen werden."}
        </div>
      ) : (
        <div className="space-y-3">
          {recs.map((r) => (
            <Link
              key={r.id}
              href={`/recommendations/${r.id}`}
              className="card flex items-center justify-between gap-4 p-4 hover:border-brand-500"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="chip bg-brand-100 text-brand-900">{r.kind}</span>
                  <PriorityBadge priority={r.priority} />
                  {r.due_at && (
                    <span className="text-xs text-brand-500">fällig {formatRelative(r.due_at)}</span>
                  )}
                </div>
                <div className="mt-1 truncate text-sm font-medium text-brand-900">{r.title}</div>
                <div className="text-xs text-brand-500">
                  {r.company?.name}
                  {r.contact?.full_name ? ` · ${r.contact.full_name}` : ""}
                </div>
              </div>
              <span className="text-sm text-brand-500">→</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="card p-4">
      <div className="text-xs uppercase tracking-wide text-brand-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-brand-900">{value}</div>
    </div>
  );
}
