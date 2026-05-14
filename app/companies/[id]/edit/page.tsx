import { redirect, notFound } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { getCompany } from "@/lib/db/queries";
import { deleteCompany, updateCompany } from "@/lib/db/mutations";
import {
  COMPANY_STATUS_LABELS,
  COMPANY_TYPE_LABELS,
  type CompanyStatus,
  type CompanyType,
  type Priority,
} from "@/types/db";

export default async function EditCompanyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const company = await getCompany(id);
  if (!company) notFound();

  async function save(formData: FormData) {
    "use server";
    await updateCompany(id, {
      name: String(formData.get("name") ?? "").trim(),
      type: String(formData.get("type") ?? "sonstige") as CompanyType,
      status: String(formData.get("status") ?? "lead") as CompanyStatus,
      priority: String(formData.get("priority") ?? "mittel") as Priority,
      website: (formData.get("website") as string) || null,
      city: (formData.get("city") as string) || null,
      notes: (formData.get("notes") as string) || null,
    });
    redirect(`/companies/${id}`);
  }

  async function remove() {
    "use server";
    await deleteCompany(id);
    redirect("/companies");
  }

  return (
    <div className="max-w-2xl">
      <PageHeader title={`${company.name} bearbeiten`} />
      <form action={save} className="card space-y-4 p-6">
        <div>
          <label className="label">Name</label>
          <input name="name" defaultValue={company.name} required className="input" />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Typ</label>
            <select name="type" defaultValue={company.type} className="input">
              {Object.entries(COMPANY_TYPE_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Status</label>
            <select name="status" defaultValue={company.status} className="input">
              {Object.entries(COMPANY_STATUS_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Priorität</label>
            <select name="priority" defaultValue={company.priority} className="input">
              <option value="hoch">hoch</option>
              <option value="mittel">mittel</option>
              <option value="niedrig">niedrig</option>
            </select>
          </div>
          <div>
            <label className="label">Stadt</label>
            <input name="city" defaultValue={company.city ?? ""} className="input" />
          </div>
        </div>
        <div>
          <label className="label">Website</label>
          <input name="website" defaultValue={company.website ?? ""} className="input" />
        </div>
        <div>
          <label className="label">Notizen</label>
          <textarea name="notes" defaultValue={company.notes ?? ""} className="input min-h-[100px]" />
        </div>
        <div className="flex justify-between">
          <button formAction={remove} className="btn-ghost text-rose-700 hover:bg-rose-50">
            Löschen
          </button>
          <button type="submit" className="btn-primary">Speichern</button>
        </div>
      </form>
    </div>
  );
}
