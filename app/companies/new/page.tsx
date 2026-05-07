import { redirect } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { createCompany } from "@/lib/db/mutations";
import { COMPANY_TYPE_LABELS, COMPANY_STATUS_LABELS, type CompanyType, type CompanyStatus, type Priority } from "@/types/db";

export default function NewCompanyPage() {
  async function action(formData: FormData) {
    "use server";
    const id = await createCompany({
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

  return (
    <div className="max-w-2xl">
      <PageHeader title="Neues Unternehmen" />
      <form action={action} className="card space-y-4 p-6">
        <div>
          <label className="label">Name</label>
          <input name="name" required className="input" autoFocus />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Typ</label>
            <select name="type" className="input" defaultValue="interior_designer">
              {Object.entries(COMPANY_TYPE_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Status</label>
            <select name="status" className="input" defaultValue="lead">
              {Object.entries(COMPANY_STATUS_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Priorität</label>
            <select name="priority" className="input" defaultValue="mittel">
              <option value="hoch">hoch</option>
              <option value="mittel">mittel</option>
              <option value="niedrig">niedrig</option>
            </select>
          </div>
          <div>
            <label className="label">Stadt</label>
            <input name="city" className="input" />
          </div>
        </div>
        <div>
          <label className="label">Website</label>
          <input name="website" className="input" placeholder="https://" />
        </div>
        <div>
          <label className="label">Notizen</label>
          <textarea name="notes" className="input min-h-[100px]" />
        </div>
        <div className="flex justify-end">
          <button type="submit" className="btn-primary">Anlegen</button>
        </div>
      </form>
    </div>
  );
}
