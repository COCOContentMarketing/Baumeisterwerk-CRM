import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { PriorityBadge } from "@/components/PriorityBadge";
import {
  listCompanies,
  listOpenRecommendations,
  type RecommendationWithRefs,
} from "@/lib/db/queries";
import type { Company } from "@/types/db";
import { formatRelative } from "@/lib/format";
import { GenerateRecommendationsButton } from "./_components/GenerateRecommendationsButton";

export const dynamic = "force-dynamic";

async function safeListCompanies(): Promise<{ ok: true; data: Company[] } | { ok: false; error: string }> {
  try {
    return { ok: true, data: await listCompanies() };
  } catch (e) {
    console.error("listCompanies fehlgeschlagen:", e);
    return { ok: false, error: e instanceof Error ? e.message : "Unbekannter Fehler" };
  }
}

async function safeListRecs(): Promise<
  { ok: true; data: RecommendationWithRefs[] } | { ok: false; error: string }
> {
  try {
    return { ok: true, data: await listOpenRecommendations() };
  } catch (e) {
    console.error("listOpenRecommendations fehlgeschlagen:", e);
    return { ok: false, error: e instanceof Error ? e.message : "Unbekannter Fehler" };
  }
}

export default async function DashboardPage() {
  const [recsRes, companiesRes] = await Promise.all([safeListRecs(), safeListCompanies()]);
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
        actions={<GenerateRecommendationsButton />}
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

function DbErrorBanner({ area, message }: { area: string; message: string }) {
  return (
    <div className="mb-4 rounded-md border border-rose-200 bg-rose-50 p-3 text-sm">
      <div className="font-medium text-rose-900">{area} konnten nicht geladen werden.</div>
      <div className="mt-1 font-mono text-xs text-rose-700">{message}</div>
      <div className="mt-1 text-xs text-rose-700">
        Pruefe in den Vercel-Logs den vollstaendigen Fehler. Haeufige Ursachen: Tabellen aus
        <code className="mx-1">supabase/migrations/0001_init.sql</code>
        wurden noch nicht eingespielt, oder
        <code className="mx-1">SUPABASE_SERVICE_ROLE_KEY</code>
        zeigt auf ein anderes Projekt als
        <code className="mx-1">NEXT_PUBLIC_SUPABASE_URL</code>.
      </div>
    </div>
  );
}
