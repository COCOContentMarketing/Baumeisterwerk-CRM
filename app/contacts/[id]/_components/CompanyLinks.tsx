"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Company } from "@/types/db";
import type { CompanyForContact } from "@/lib/db/queries";
import { linkContact, setPrimaryContact, unlinkContact } from "@/lib/db/mutations";

export function CompanyLinks({
  contactId,
  links,
  allCompanies,
}: {
  contactId: string;
  links: CompanyForContact[];
  allCompanies: Company[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [picker, setPicker] = useState(false);

  const linkedIds = new Set(links.map((l) => l.id));
  const candidates = allCompanies.filter((c) => !linkedIds.has(c.id));

  function makePrimary(companyId: string) {
    startTransition(async () => {
      await setPrimaryContact({ contact_id: contactId, company_id: companyId });
      router.refresh();
    });
  }

  function unlink(companyId: string) {
    startTransition(async () => {
      await unlinkContact({ contact_id: contactId, company_id: companyId });
      router.refresh();
    });
  }

  function add(formData: FormData) {
    const companyId = String(formData.get("company_id") ?? "");
    if (!companyId) return;
    const isPrimary = formData.get("is_primary") === "on";
    startTransition(async () => {
      await linkContact({
        contact_id: contactId,
        company_id: companyId,
        is_primary: isPrimary,
      });
      setPicker(false);
      router.refresh();
    });
  }

  return (
    <section className="card p-6">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-brand-900">Zugeordnete Unternehmen</h2>
        {candidates.length > 0 && (
          <button
            type="button"
            onClick={() => setPicker((v) => !v)}
            className="text-xs font-medium text-brand-700 hover:underline"
            disabled={pending}
          >
            {picker ? "Abbrechen" : "+ Unternehmen zuordnen"}
          </button>
        )}
      </div>

      {links.length === 0 ? (
        <p className="text-xs text-brand-500">Noch keinen Unternehmen zugeordnet.</p>
      ) : (
        <ul className="space-y-3">
          {links.map((l) => (
            <li
              key={l.link_id}
              className="flex items-start justify-between gap-3 rounded-md border border-brand-100 p-3"
            >
              <div className="min-w-0 flex-1">
                <Link
                  href={`/companies/${l.id}`}
                  className="block truncate text-sm font-medium text-brand-900 hover:underline"
                >
                  {l.name}
                </Link>
                {l.location_label && (
                  <div className="text-xs text-brand-500">{l.location_label}</div>
                )}
                {l.link_role && <div className="text-xs text-brand-500">{l.link_role}</div>}
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <label className="flex items-center gap-1 text-xs">
                  <input
                    type="radio"
                    name={`primary-${contactId}`}
                    checked={l.link_is_primary}
                    disabled={pending}
                    onChange={() => makePrimary(l.id)}
                  />
                  Primär
                </label>
                <button
                  type="button"
                  onClick={() => unlink(l.id)}
                  disabled={pending}
                  className="text-xs text-rose-700 hover:underline"
                  title="Zuordnung entfernen"
                >
                  Entfernen
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {picker && candidates.length > 0 && (
        <form action={add} className="mt-4 space-y-3 rounded-md border border-brand-100 p-3">
          <div>
            <label className="label">Unternehmen</label>
            <select name="company_id" required className="input">
              <option value="">— wählen —</option>
              {candidates.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.location_label ? ` (${c.location_label})` : ""}
                </option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-2 text-xs">
            <input type="checkbox" name="is_primary" />
            Als primären Kontakt dieses Unternehmens setzen
          </label>
          <div className="flex justify-end">
            <button type="submit" disabled={pending} className="btn-primary">
              Zuordnen
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
