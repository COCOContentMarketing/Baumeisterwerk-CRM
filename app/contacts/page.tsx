import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { listAllContacts } from "@/lib/db/queries";
import { formatRelative } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ContactsPage() {
  const contacts = await listAllContacts();
  return (
    <div>
      <PageHeader title="Kontakte" subtitle={`${contacts.length} Personen`} />
      {contacts.length === 0 ? (
        <div className="card p-8 text-center text-sm text-brand-500">
          Noch keine Kontakte. Lege zuerst ein Unternehmen an und füge dort Personen hinzu.
        </div>
      ) : (
        <div className="card overflow-hidden">
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
      )}
    </div>
  );
}
