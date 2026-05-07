import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { PriorityBadge } from "@/components/PriorityBadge";
import { listCompanies, listOpenRecommendations } from "@/lib/db/queries";
import { formatRelative } from "@/lib/format";
import { GenerateRecommendationsButton } from "./_components/GenerateRecommendationsButton";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [recs, companies] = await Promise.all([listOpenRecommendations(), listCompanies()]);

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
        actions={<GenerateRecommendationsButton />}
      />

      <div className="mb-8 grid grid-cols-4 gap-4">
        <Stat label="Unternehmen" value={stats.total} />
        <Stat label="Leads" value={stats.leads} />
        <Stat label="In Gespräch" value={stats.inGespraech} />
        <Stat label="Kunden" value={stats.kunden} />
      </div>

      <h2 className="mb-3 text-lg font-semibold text-brand-900">Empfohlene nächste Schritte</h2>
      {recs.length === 0 ? (
        <div className="card p-6 text-center text-sm text-brand-500">
          Keine offenen Empfehlungen. Klicke auf „Empfehlungen generieren" oben rechts.
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
