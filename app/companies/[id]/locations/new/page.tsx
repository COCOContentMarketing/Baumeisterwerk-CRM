import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { getCompany } from "@/lib/db/queries";
import { createLocation } from "@/lib/db/mutations";

export const dynamic = "force-dynamic";

export default async function NewLocationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const parent = await getCompany(id);
  if (!parent) notFound();

  async function submit(formData: FormData) {
    "use server";
    const name = String(formData.get("name") ?? "").trim();
    if (!name) return;
    const locationLabel = String(formData.get("location_label") ?? "").trim();
    const city = String(formData.get("city") ?? "").trim();
    const address = String(formData.get("address") ?? "").trim();
    const notes = String(formData.get("notes") ?? "").trim();
    await createLocation({
      parent_company_id: id,
      name,
      location_label: locationLabel || null,
      city: city || null,
      address: address || null,
      notes: notes || null,
    });
    redirect(`/companies/${id}`);
  }

  return (
    <div className="max-w-xl">
      <PageHeader
        title={`Standort hinzufügen`}
        subtitle={
          <>
            Wird als Tochter-Eintrag von{" "}
            <Link href={`/companies/${id}`} className="text-brand-700 hover:underline">
              {parent.name}
            </Link>{" "}
            angelegt.
          </>
        }
      />
      <form action={submit} className="card space-y-4 p-6">
        <div>
          <label className="label">Name *</label>
          <input
            name="name"
            required
            defaultValue={parent.name}
            className="input"
          />
          <p className="mt-1 text-xs text-brand-500">
            Vorbelegt mit dem Namen des Dach-Unternehmens. Bitte ggf. mit Standort-Suffix versehen, z.B. „{parent.name} München".
          </p>
        </div>
        <div>
          <label className="label">Standort-Label</label>
          <input
            name="location_label"
            placeholder="z.B. München / Tegernsee / Hauptsitz"
            className="input"
          />
        </div>
        <div>
          <label className="label">Stadt</label>
          <input name="city" defaultValue={parent.city ?? ""} className="input" />
        </div>
        <div>
          <label className="label">Adresse</label>
          <input name="address" className="input" />
        </div>
        <div>
          <label className="label">Notizen</label>
          <textarea name="notes" className="input min-h-[80px]" />
        </div>
        <div className="flex justify-end gap-2">
          <Link href={`/companies/${id}`} className="btn-ghost">
            Abbrechen
          </Link>
          <button type="submit" className="btn-primary">
            Standort anlegen
          </button>
        </div>
      </form>
    </div>
  );
}
