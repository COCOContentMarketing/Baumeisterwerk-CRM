import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { PriorityBadge } from "@/components/PriorityBadge";
import { Timeline } from "@/components/Timeline";
import { ChatComposer } from "@/components/ChatComposer";
import {
  getCompany,
  listContactsForCompany,
  listInteractionsForCompany,
  listLocations,
} from "@/lib/db/queries";
import { COMPANY_TYPE_LABELS } from "@/types/db";

export const dynamic = "force-dynamic";

export default async function CompanyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const company = await getCompany(id);
  if (!company) notFound();

  const [contacts, interactions, locations, parent] = await Promise.all([
    listContactsForCompany(id),
    listInteractionsForCompany(id),
    listLocations(id),
    company.parent_company_id ? getCompany(company.parent_company_id) : Promise.resolve(null),
  ]);

  return (
    <div>
      <PageHeader
        title={company.name}
        subtitle={
          <>
            {parent && (
              <>
                Standort von{" "}
                <Link href={`/companies/${parent.id}`} className="text-brand-700 hover:underline">
                  {parent.name}
                </Link>
                {" · "}
              </>
            )}
            {COMPANY_TYPE_LABELS[company.type]}
            {company.location_label ? ` · ${company.location_label}` : company.city ? ` · ${company.city}` : ""}
            {company.is_group && " · Gruppe"}
          </>
        }
        actions={
          <div className="flex items-center gap-2">
            <StatusBadge status={company.status} />
            <PriorityBadge priority={company.priority} />
            <Link href={`/companies/${id}/edit`} className="btn-secondary">Bearbeiten</Link>
          </div>
        }
      />

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 space-y-6">
          <section className="card p-6">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-brand-900">Kommunikation</h2>
            </div>
            <Timeline interactions={interactions} contacts={contacts} />
            <ChatComposer companyId={company.id} contacts={contacts} />
          </section>
        </div>

        <aside className="space-y-6">
          {(company.is_group || locations.length > 0) && (
            <section className="card p-6">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-brand-900">Standorte</h2>
                <Link
                  href={`/companies/${id}/locations/new`}
                  className="text-xs font-medium text-brand-700 hover:underline"
                >
                  + Standort hinzufügen
                </Link>
              </div>
              {locations.length === 0 ? (
                <p className="text-xs text-brand-500">
                  Noch keine Standorte. Lege einen an, um diesen Eintrag als Dach-Unternehmen zu nutzen.
                </p>
              ) : (
                <ul className="space-y-2">
                  {locations.map((loc) => (
                    <li key={loc.id}>
                      <Link
                        href={`/companies/${loc.id}`}
                        className="block rounded-md border border-brand-100 px-3 py-2 hover:border-brand-300 hover:bg-brand-50"
                      >
                        <div className="text-sm font-medium text-brand-900">
                          {loc.location_label || loc.name}
                        </div>
                        <div className="text-xs text-brand-500">
                          {loc.city ?? loc.address ?? loc.name}
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          <section className="card p-6">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-brand-900">Kontaktpersonen</h2>
              <Link
                href={`/companies/${id}/contacts/new`}
                className="text-xs font-medium text-brand-700 hover:underline"
              >
                + Hinzufügen
              </Link>
            </div>
            {contacts.length === 0 ? (
              <p className="text-xs text-brand-500">Noch keine Kontaktpersonen.</p>
            ) : (
              <ul className="space-y-3">
                {contacts.map((c) => (
                  <li key={c.link_id} className="flex items-start justify-between gap-2">
                    <Link href={`/contacts/${c.id}`} className="block min-w-0 flex-1 hover:underline">
                      <div className="flex items-center gap-2 text-sm font-medium text-brand-900">
                        <span className="truncate">{c.full_name || c.email || "(unbenannt)"}</span>
                        {c.link_is_primary && (
                          <span className="chip bg-brand-100 text-brand-700">Primär</span>
                        )}
                      </div>
                      {(c.link_role ?? c.role) && (
                        <div className="text-xs text-brand-500">{c.link_role ?? c.role}</div>
                      )}
                      {c.email && <div className="truncate text-xs text-brand-500">{c.email}</div>}
                    </Link>
                    {!c.link_is_primary && c.email && (
                      <Link
                        href={`/contacts/${c.id}?compose=1`}
                        title="Zusaetzlich anschreiben"
                        className="shrink-0 text-xs text-brand-700 hover:underline"
                      >
                        ✉ Anschreiben
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card p-6">
            <h2 className="mb-3 text-sm font-semibold text-brand-900">Details</h2>
            <dl className="space-y-2 text-xs">
              {company.website && (
                <Detail label="Website">
                  <a href={company.website} target="_blank" className="text-brand-700 hover:underline">
                    {company.website}
                  </a>
                </Detail>
              )}
              {company.address && <Detail label="Adresse">{company.address}</Detail>}
              {company.notes && (
                <Detail label="Notizen">
                  <span className="whitespace-pre-wrap">{company.notes}</span>
                </Detail>
              )}
            </dl>
          </section>
        </aside>
      </div>
    </div>
  );
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-brand-500">{label}</dt>
      <dd className="text-brand-900">{children}</dd>
    </div>
  );
}
