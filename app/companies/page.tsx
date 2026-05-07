import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { PriorityBadge } from "@/components/PriorityBadge";
import { listCompanies } from "@/lib/db/queries";
import { COMPANY_TYPE_LABELS } from "@/types/db";
import { formatRelative } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function CompaniesPage() {
  const companies = await listCompanies();
  return (
    <div>
      <PageHeader
        title="Unternehmen"
        subtitle={`${companies.length} Einträge`}
        actions={
          <Link href="/companies/new" className="btn-primary">
            + Neues Unternehmen
          </Link>
        }
      />
      {companies.length === 0 ? (
        <div className="card p-8 text-center text-sm text-brand-500">
          Noch keine Unternehmen angelegt.
        </div>
      ) : (
        <div className="card overflow-hidden">
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
                  <td className="px-4 py-3 text-brand-500">{formatRelative(c.last_interaction_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
