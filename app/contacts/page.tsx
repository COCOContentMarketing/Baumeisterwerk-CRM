import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { DbErrorBanner } from "@/components/DbErrorBanner";
import { listAllContacts } from "@/lib/db/queries";
import { safeRun } from "@/lib/db/safe";
import { formatRelative } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ContactsPage() {
  const res = await safeRun("listAllContacts", listAllContacts);
  const contacts = res.ok ? res.data : [];
  return (
    <div>
      <PageHeader title="Kontakte" subtitle={res.ok ? `${contacts.length} Personen` : undefined} />
      {!res.ok && <DbErrorBanner area="Kontakte" message={res.error} />}
      {res.ok && contacts.length === 0 ? (
        <div className="card p-8 text-center text-sm text-brand-500">
          Noch keine Kontakte. Lege zuerst ein Unternehmen an und füge dort Personen hinzu.
        </div>
      ) : contacts.length > 0 ? (
        <>
          {/* Mobil: Karten statt Tabelle */}
          <div className="space-y-3 md:hidden">
            {contacts.map((c) => (
              <div key={c.id} className="card p-4">
                <Link
                  href={`/contacts/${c.id}`}
                  className="font-medium text-brand-900 hover:underline"
                >
                  {c.full_name || c.email || "(unbenannt)"}
                </Link>
                <div className="mt-1 text-sm">
                  <Link
                    href={`/companies/${c.company.id}`}
                    className="text-brand-700 hover:underline"
                  >
                    {c.company.name}
                  </Link>
                </div>
                <dl className="mt-2 space-y-1 text-xs text-brand-500">
                  {c.role && (
                    <div>
                      <span className="text-brand-400">Rolle:</span> {c.role}
                    </div>
                  )}
                  {c.email && (
                    <div>
                      <span className="text-brand-400">Email:</span> {c.email}
                    </div>
                  )}
                  <div>
                    <span className="text-brand-400">Letzter Kontakt:</span>{" "}
                    {formatRelative(c.last_interaction_at)}
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
                  <th className="px-4 py-3">Unternehmen</th>
                  <th className="px-4 py-3">Rolle</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Letzter Kontakt</th>
                </tr>
              </thead>
              <tbody>
                {contacts.map((c) => (
                  <tr key={c.id} className="border-t border-brand-100 hover:bg-brand-50/50">
                    <td className="px-4 py-3">
                      <Link href={`/contacts/${c.id}`} className="font-medium text-brand-900 hover:underline">
                        {c.full_name || c.email || "(unbenannt)"}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/companies/${c.company.id}`} className="text-brand-700 hover:underline">
                        {c.company.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-brand-700">{c.role ?? "—"}</td>
                    <td className="px-4 py-3 text-brand-700">{c.email ?? "—"}</td>
                    <td className="px-4 py-3 text-brand-500">{formatRelative(c.last_interaction_at)}</td>
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
