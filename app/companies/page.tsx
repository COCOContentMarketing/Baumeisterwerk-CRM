import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { PriorityBadge } from "@/components/PriorityBadge";
import { DbErrorBanner } from "@/components/DbErrorBanner";
import { listCompanies, type CompanyView } from "@/lib/db/queries";
import { safeRun } from "@/lib/db/safe";
import { COMPANY_TYPE_LABELS } from "@/types/db";
import { formatRelative } from "@/lib/format";

export const dynamic = "force-dynamic";

const FILTER_LABELS: Record<CompanyView, string> = {
  all: "Alle",
  groups: "Nur Dach",
  leafs: "Nur Standorte",
};

function asView(v: string | undefined): CompanyView {
  if (v === "groups" || v === "leafs") return v;
  return "all";
}

export default async function CompaniesPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const params = await searchParams;
  const view = asView(params.view);
  const res = await safeRun("listCompanies", () => listCompanies(view));
  const companies = res.ok ? res.data : [];
  return (
    <div>
      <PageHeader
        title="Unternehmen"
        subtitle={res.ok ? `${companies.length} Einträge` : undefined}
        actions={
          <Link href="/companies/new" className="btn-primary">
            + Neues Unternehmen
          </Link>
        }
      />
      <div className="mb-4 flex flex-wrap gap-2">
        {(Object.keys(FILTER_LABELS) as CompanyView[]).map((v) => {
          const active = v === view;
          const href = v === "all" ? "/companies" : `/companies?view=${v}`;
          return (
            <Link
              key={v}
              href={href}
              className={`chip ${active ? "bg-brand-900 text-white" : "bg-brand-100 text-brand-900 hover:bg-brand-200"}`}
            >
              {FILTER_LABELS[v]}
            </Link>
          );
        })}
      </div>
      {!res.ok && <DbErrorBanner area="Unternehmen" message={res.error} />}
      {res.ok && companies.length === 0 ? (
        <div className="card p-8 text-center text-sm text-brand-500">
          Keine Unternehmen in dieser Ansicht.
        </div>
      ) : companies.length > 0 ? (
        <>
          {/* Mobil: Karten statt Tabelle */}
          <div className="space-y-3 md:hidden">
            {companies.map((c) => (
              <div key={c.id} className="card p-4">
                <div className="flex items-start justify-between gap-2">
                  <Link
                    href={`/companies/${c.id}`}
                    className="font-medium text-brand-900 hover:underline"
                  >
                    {c.name}
                  </Link>
                  <div className="flex shrink-0 flex-wrap items-center justify-end gap-1">
                    <StatusBadge status={c.status} />
                    <PriorityBadge priority={c.priority} />
                  </div>
                </div>
                <dl className="mt-2 space-y-1 text-xs text-brand-500">
                  <div>
                    <span className="text-brand-400">Typ:</span>{" "}
                    {COMPANY_TYPE_LABELS[c.type]}
                  </div>
                  {c.city && (
                    <div>
                      <span className="text-brand-400">Stadt:</span> {c.city}
                    </div>
                  )}
                  <div>
                    <span className="text-brand-400">Letzter Kontakt:</span>{" "}
                    {formatRelative(c.effective_last_interaction_at)}
                    {c.is_group &&
                      c.effective_last_interaction_at !== c.last_interaction_at && (
                        <span
                          className="ml-1 text-brand-400"
                          title="Spätester Kontakt über alle Standorte dieser Gruppe"
                        >
                          (Standort)
                        </span>
                      )}
                  </div>
                </dl>
              </div>
            ))}
          </div>

          {/* Ab md: Tabelle */}
          <div className="card hidden overflow-hidden md:block">
            <table className="w-full text-left text-sm">
              <thead className="bg-brand-50 text-xs uppercase text-brand-500">
                <tr>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Typ</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Priorität</th>
                  <th className="px-4 py-3">Stadt</th>
                  <th className="px-4 py-3">Letzter Kontakt</th>
                </tr>
              </thead>
              <tbody>
                {companies.map((c) => (
                  <tr key={c.id} className="border-t border-brand-100 hover:bg-brand-50/50">
                    <td className="px-4 py-3">
                      <Link href={`/companies/${c.id}`} className="font-medium text-brand-900 hover:underline">
                        {c.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-brand-700">{COMPANY_TYPE_LABELS[c.type]}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={c.status} />
                    </td>
                    <td className="px-4 py-3">
                      <PriorityBadge priority={c.priority} />
                    </td>
                    <td className="px-4 py-3 text-brand-700">{c.city ?? "—"}</td>
                    <td className="px-4 py-3 text-brand-500">
                      {formatRelative(c.effective_last_interaction_at)}
                      {c.is_group &&
                        c.effective_last_interaction_at !== c.last_interaction_at && (
                          <span
                            className="ml-1 text-xs text-brand-400"
                            title="Spätester Kontakt über alle Standorte dieser Gruppe"
                          >
                            (Standort)
                          </span>
                        )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </div>
  );
}
