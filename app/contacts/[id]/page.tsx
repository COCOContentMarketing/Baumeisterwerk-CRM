import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { Timeline } from "@/components/Timeline";
import { ChatComposer } from "@/components/ChatComposer";
import { ComposeEmailButton } from "./_components/ComposeEmailButton";
import { CompanyLinks } from "./_components/CompanyLinks";
import {
  getContact,
  listCompanies,
  listCompaniesForContact,
  listContactsForCompany,
  listInteractionsForContact,
} from "@/lib/db/queries";

export const dynamic = "force-dynamic";

export default async function ContactDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ compose?: string }>;
}) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const contact = await getContact(id);
  if (!contact) notFound();

  const [interactions, allCompanyContacts, linkedCompanies, allCompanies] = await Promise.all([
    listInteractionsForContact(id),
    listContactsForCompany(contact.company_id),
    listCompaniesForContact(id),
    listCompanies("all"),
  ]);
  const composeOpen = sp.compose === "1";

  return (
    <div>
      <PageHeader
        title={contact.full_name || contact.email || "Unbenannter Kontakt"}
        subtitle={
          <>
            <Link href={`/companies/${contact.company.id}`} className="hover:underline">
              {contact.company.name}
            </Link>
            {contact.role ? ` · ${contact.role}` : ""}
          </>
        }
        actions={
          <div className="flex items-center gap-2">
            {contact.email && (
              <ComposeEmailButton contactId={contact.id} initialOpen={composeOpen} />
            )}
            <Link href={`/contacts/${contact.id}/edit`} className="btn-secondary">
              Bearbeiten
            </Link>
          </div>
        }
      />

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 space-y-6">
          <section className="card p-6">
            <h2 className="mb-3 text-lg font-semibold text-brand-900">Verlauf</h2>
            <Timeline interactions={interactions} contacts={allCompanyContacts} />
            <ChatComposer companyId={contact.company_id} contacts={[contact]} />
          </section>
        </div>

        <aside className="space-y-6">
          <CompanyLinks
            contactId={contact.id}
            links={linkedCompanies}
            allCompanies={allCompanies}
          />

          <section className="card p-6">
            <h2 className="mb-3 text-sm font-semibold text-brand-900">Kontaktdaten</h2>
            <dl className="space-y-2 text-xs">
              {contact.email && (
                <Detail label="Email">
                  <a href={`mailto:${contact.email}`} className="text-brand-700 hover:underline">
                    {contact.email}
                  </a>
                </Detail>
              )}
              {contact.phone && <Detail label="Telefon">{contact.phone}</Detail>}
              <Detail label="Sprache">{contact.language === "de" ? "Deutsch" : "Englisch"}</Detail>
              {contact.linkedin_url && (
                <Detail label="LinkedIn">
                  <a href={contact.linkedin_url} target="_blank" className="text-brand-700 hover:underline">
                    Profil
                  </a>
                </Detail>
              )}
              {contact.notes && (
                <Detail label="Notizen">
                  <span className="whitespace-pre-wrap">{contact.notes}</span>
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
