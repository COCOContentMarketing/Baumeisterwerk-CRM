import { redirect, notFound } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { getContact } from "@/lib/db/queries";
import { deleteContact, updateContact } from "@/lib/db/mutations";
import type { ContactLanguage } from "@/types/db";

export default async function EditContactPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const contact = await getContact(id);
  if (!contact) notFound();
  const companyId = contact.company_id;

  async function save(formData: FormData) {
    "use server";
    await updateContact(id, {
      first_name: (formData.get("first_name") as string) || null,
      last_name: (formData.get("last_name") as string) || null,
      role: (formData.get("role") as string) || null,
      email: (formData.get("email") as string) || null,
      phone: (formData.get("phone") as string) || null,
      language: (String(formData.get("language") ?? "de")) as ContactLanguage,
      is_primary: formData.get("is_primary") === "on",
      notes: (formData.get("notes") as string) || null,
    });
    redirect(`/contacts/${id}`);
  }

  async function remove() {
    "use server";
    await deleteContact(id);
    redirect(`/companies/${companyId}`);
  }

  return (
    <div className="max-w-2xl">
      <PageHeader title="Kontakt bearbeiten" />
      <form action={save} className="card space-y-4 p-6">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Vorname</label>
            <input name="first_name" defaultValue={contact.first_name ?? ""} className="input" />
          </div>
          <div>
            <label className="label">Nachname</label>
            <input name="last_name" defaultValue={contact.last_name ?? ""} className="input" />
          </div>
          <div>
            <label className="label">Rolle</label>
            <input name="role" defaultValue={contact.role ?? ""} className="input" />
          </div>
          <div>
            <label className="label">Sprache</label>
            <select name="language" defaultValue={contact.language} className="input">
              <option value="de">Deutsch</option>
              <option value="en">Englisch</option>
            </select>
          </div>
          <div>
            <label className="label">Email</label>
            <input name="email" type="email" defaultValue={contact.email ?? ""} className="input" />
          </div>
          <div>
            <label className="label">Telefon</label>
            <input name="phone" defaultValue={contact.phone ?? ""} className="input" />
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="is_primary" defaultChecked={contact.is_primary} /> Primärer Kontakt
        </label>
        <div>
          <label className="label">Notizen</label>
          <textarea name="notes" defaultValue={contact.notes ?? ""} className="input min-h-[80px]" />
        </div>
        <div className="flex justify-between">
          <button formAction={remove} className="btn-ghost text-rose-700 hover:bg-rose-50">Löschen</button>
          <button type="submit" className="btn-primary">Speichern</button>
        </div>
      </form>
    </div>
  );
}
