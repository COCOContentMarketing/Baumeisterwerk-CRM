import { redirect } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { createContact } from "@/lib/db/mutations";
import type { ContactLanguage } from "@/types/db";

export default async function NewContactPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: companyId } = await params;

  async function action(formData: FormData) {
    "use server";
    await createContact({
      company_id: companyId,
      first_name: (formData.get("first_name") as string) || null,
      last_name: (formData.get("last_name") as string) || null,
      role: (formData.get("role") as string) || null,
      email: (formData.get("email") as string) || null,
      phone: (formData.get("phone") as string) || null,
      language: (String(formData.get("language") ?? "de")) as ContactLanguage,
      is_primary: formData.get("is_primary") === "on",
      notes: (formData.get("notes") as string) || null,
    });
    redirect(`/companies/${companyId}`);
  }

  return (
    <div className="max-w-2xl">
      <PageHeader title="Neue Kontaktperson" />
      <form action={action} className="card space-y-4 p-6">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Vorname</label>
            <input name="first_name" className="input" autoFocus />
          </div>
          <div>
            <label className="label">Nachname</label>
            <input name="last_name" className="input" />
          </div>
          <div>
            <label className="label">Rolle / Position</label>
            <input name="role" className="input" />
          </div>
          <div>
            <label className="label">Sprache</label>
            <select name="language" className="input" defaultValue="de">
              <option value="de">Deutsch</option>
              <option value="en">Englisch</option>
            </select>
          </div>
          <div>
            <label className="label">Email</label>
            <input name="email" type="email" className="input" />
          </div>
          <div>
            <label className="label">Telefon</label>
            <input name="phone" className="input" />
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="is_primary" /> Primärer Kontakt
        </label>
        <div>
          <label className="label">Notizen</label>
          <textarea name="notes" className="input min-h-[80px]" />
        </div>
        <div className="flex justify-end">
          <button type="submit" className="btn-primary">Anlegen</button>
        </div>
      </form>
    </div>
  );
}
