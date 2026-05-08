import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { PriorityBadge } from "@/components/PriorityBadge";
import { DbErrorBanner } from "@/components/DbErrorBanner";
import { GenerateRecommendationsButton } from "../_components/GenerateRecommendationsButton";
import { listOpenRecommendations } from "@/lib/db/queries";
import { safeRun } from "@/lib/db/safe";
import { formatRelative } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function RecommendationsPage() {
  const res = await safeRun("listOpenRecommendations", listOpenRecommendations);
  const recs = res.ok ? res.data : [];
  return (
    <div>
      <PageHeader
        title="Empfehlungen"
        subtitle={res.ok ? `${recs.length} offene Vorschläge` : undefined}
        actions={<GenerateRecommendationsButton />}
      />
      {!res.ok && <DbErrorBanner area="Empfehlungen" message={res.error} />}
      {res.ok && recs.length === 0 ? (
        <div className="card p-8 text-center text-sm text-brand-500">
          Keine offenen Empfehlungen. Klicke auf Empfehlungen generieren.
        </div>
      ) : recs.length > 0 ? (
        <div className="space-y-3">
          {recs.map((r) => (
            <Link
              key={r.id}
              href={`/recommendations/${r.id}`}
              className="card flex items-center justify-between p-4 hover:border-brand-500"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="chip bg-brand-100 text-brand-900">{r.kind}</span>
                  <PriorityBadge priority={r.priority} />
                  {r.due_at && (
                    <span className="text-xs text-brand-500">fällig {formatRelative(r.due_at)}</span>
                  )}
                </div>
                <div className="mt-1 text-sm font-medium text-brand-900">{r.title}</div>
                {r.reason && <div className="text-xs text-brand-500">{r.reason}</div>}
                <div className="mt-1 text-xs text-brand-500">
                  {r.company?.name}
                  {r.contact?.full_name ? ` · ${r.contact.full_name}` : ""}
                </div>
              </div>
              <span className="text-sm text-brand-500">→</span>
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}
