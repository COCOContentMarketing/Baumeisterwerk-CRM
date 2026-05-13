"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type {
  CompanyStatus,
  CompanyType,
  ContactLanguage,
  InteractionType,
  Priority,
  RecommendationStatus,
} from "@/types/db";

// ---------- Companies ----------

export async function createCompany(input: {
  name: string;
  type: CompanyType;
  status?: CompanyStatus;
  priority?: Priority;
  website?: string | null;
  city?: string | null;
  notes?: string | null;
}) {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("companies")
    .insert({
      name: input.name,
      type: input.type,
      status: input.status ?? "lead",
      priority: input.priority ?? "mittel",
      website: input.website ?? null,
      city: input.city ?? null,
      notes: input.notes ?? null,
    })
    .select("id")
    .single();
  if (error) throw error;
  revalidatePath("/companies");
  return data.id as string;
}

export async function updateCompany(
  id: string,
  patch: Partial<{
    name: string;
    type: CompanyType;
    status: CompanyStatus;
    priority: Priority;
    website: string | null;
    city: string | null;
    notes: string | null;
    next_action_at: string | null;
  }>,
) {
  const sb = getSupabaseAdmin();
  const { error } = await sb.from("companies").update(patch).eq("id", id);
  if (error) throw error;
  revalidatePath("/companies");
  revalidatePath(`/companies/${id}`);
}

export async function deleteCompany(id: string) {
  const sb = getSupabaseAdmin();
  const { error } = await sb.from("companies").delete().eq("id", id);
  if (error) throw error;
  revalidatePath("/companies");
}

// ---------- Contacts ----------

export async function createContact(input: {
  company_id: string;
  first_name?: string | null;
  last_name?: string | null;
  role?: string | null;
  email?: string | null;
  phone?: string | null;
  language?: ContactLanguage;
  is_primary?: boolean;
  notes?: string | null;
}) {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("contacts")
    .insert({
      company_id: input.company_id,
      first_name: input.first_name ?? null,
      last_name: input.last_name ?? null,
      role: input.role ?? null,
      email: input.email ?? null,
      phone: input.phone ?? null,
      language: input.language ?? "de",
      is_primary: input.is_primary ?? false,
      notes: input.notes ?? null,
    })
    .select("id")
    .single();
  if (error) throw error;

  // Spiegelt den Kontakt sofort als Link auf seine Anker-Company. Das ist
  // ab Migration 0008 die Quelle der Wahrheit fuer "primaerer Kontakt
  // dieses Standorts" (Trigger demoted andere Primaries der Company).
  const linkRes = await sb.from("contact_company_links").insert({
    contact_id: data.id as string,
    company_id: input.company_id,
    is_primary: input.is_primary ?? false,
    role: input.role ?? null,
  });
  if (linkRes.error && String(linkRes.error.code) !== "23505") throw linkRes.error;

  revalidatePath(`/companies/${input.company_id}`);
  revalidatePath("/contacts");
  return data.id as string;
}

export async function updateContact(
  id: string,
  patch: Partial<{
    first_name: string | null;
    last_name: string | null;
    role: string | null;
    email: string | null;
    phone: string | null;
    language: ContactLanguage;
    is_primary: boolean;
    notes: string | null;
  }>,
) {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("contacts")
    .update(patch)
    .eq("id", id)
    .select("company_id")
    .single();
  if (error) throw error;

  // Wenn is_primary geaendert wurde: zusaetzlich den Link auf die Anker-
  // Company spiegeln (Backward-Compat fuer alte Edit-Form). Der DB-Trigger
  // demoted automatisch andere Primaries derselben Company.
  if (patch.is_primary !== undefined) {
    await sb
      .from("contact_company_links")
      .update({ is_primary: patch.is_primary })
      .eq("contact_id", id)
      .eq("company_id", data.company_id);
  }

  revalidatePath(`/companies/${data.company_id}`);
  revalidatePath(`/contacts/${id}`);
}

export async function deleteContact(id: string) {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("contacts")
    .delete()
    .eq("id", id)
    .select("company_id")
    .single();
  if (error) throw error;
  revalidatePath(`/companies/${data.company_id}`);
  revalidatePath("/contacts");
}

// ---------- Interactions ----------

export async function logInteraction(input: {
  company_id: string;
  contact_id?: string | null;
  type: InteractionType;
  subject?: string | null;
  body?: string | null;
  occurred_at?: string;
  metadata?: Record<string, unknown>;
}) {
  const sb = getSupabaseAdmin();
  const direction =
    input.type === "email_received" ? "inbound" : input.type === "note" ? "internal" : "outbound";
  const { error } = await sb.from("interactions").insert({
    company_id: input.company_id,
    contact_id: input.contact_id ?? null,
    type: input.type,
    direction,
    subject: input.subject ?? null,
    body: input.body ?? null,
    occurred_at: input.occurred_at ?? new Date().toISOString(),
    metadata: input.metadata ?? {},
  });
  if (error) throw error;
  revalidatePath(`/companies/${input.company_id}`);
  if (input.contact_id) revalidatePath(`/contacts/${input.contact_id}`);
}

// ---------- Recommendations ----------

export async function setRecommendationStatus(id: string, status: RecommendationStatus) {
  const sb = getSupabaseAdmin();
  const { error } = await sb.from("recommendations").update({ status }).eq("id", id);
  if (error) throw error;
  revalidatePath("/");
  revalidatePath("/recommendations");
}

/**
 * Schiebt eine Empfehlung auf Wiedervorlage. Wir speichern den Zeitpunkt in
 * snoozed_until; der Readiness-Klassifikator in lib/recommendations/readiness.ts
 * bewertet das Reco anschliessend als "wartend", bis die Zeit erreicht ist.
 *
 * @param until akzeptiert Date oder ISO-String. Werte in der Vergangenheit
 *              sind erlaubt - sie wirken wie ein sofortiges Aufwecken.
 */
export async function snoozeRecommendation(id: string, until: Date | string) {
  const sb = getSupabaseAdmin();
  const iso = typeof until === "string" ? until : until.toISOString();
  const { error } = await sb
    .from("recommendations")
    .update({ snoozed_until: iso })
    .eq("id", id);
  if (error) throw error;
  revalidatePath("/");
  revalidatePath("/recommendations");
  revalidatePath(`/recommendations/${id}`);
}

export async function unsnoozeRecommendation(id: string) {
  const sb = getSupabaseAdmin();
  const { error } = await sb
    .from("recommendations")
    .update({ snoozed_until: null })
    .eq("id", id);
  if (error) throw error;
  revalidatePath("/");
  revalidatePath("/recommendations");
  revalidatePath(`/recommendations/${id}`);
}

// ---------- Contact-Company-Links (Multi-Location) ----------

export async function linkContact(input: {
  contact_id: string;
  company_id: string;
  role?: string | null;
  is_primary?: boolean;
}) {
  const sb = getSupabaseAdmin();
  const { error } = await sb
    .from("contact_company_links")
    .upsert(
      {
        contact_id: input.contact_id,
        company_id: input.company_id,
        role: input.role ?? null,
        is_primary: input.is_primary ?? false,
      },
      { onConflict: "contact_id,company_id" },
    );
  if (error) throw error;
  revalidatePath(`/contacts/${input.contact_id}`);
  revalidatePath(`/companies/${input.company_id}`);
}

export async function unlinkContact(input: { contact_id: string; company_id: string }) {
  const sb = getSupabaseAdmin();
  const { error } = await sb
    .from("contact_company_links")
    .delete()
    .eq("contact_id", input.contact_id)
    .eq("company_id", input.company_id);
  if (error) throw error;
  revalidatePath(`/contacts/${input.contact_id}`);
  revalidatePath(`/companies/${input.company_id}`);
}

/**
 * Setzt einen Kontakt als primaer fuer eine Company. Der DB-Trigger
 * set_single_primary_per_company demoted automatisch alle anderen
 * Primaries derselben Company - die UI muss das nicht selbst tun.
 */
export async function setPrimaryContact(input: { contact_id: string; company_id: string }) {
  const sb = getSupabaseAdmin();
  const { error } = await sb
    .from("contact_company_links")
    .update({ is_primary: true })
    .eq("contact_id", input.contact_id)
    .eq("company_id", input.company_id);
  if (error) throw error;
  revalidatePath(`/contacts/${input.contact_id}`);
  revalidatePath(`/companies/${input.company_id}`);
}

// ---------- Locations (Multi-Location) ----------

export async function createLocation(input: {
  parent_company_id: string;
  name: string;
  location_label?: string | null;
  city?: string | null;
  address?: string | null;
  notes?: string | null;
}) {
  const sb = getSupabaseAdmin();
  // Defaults erben wir bewusst NICHT automatisch vom Parent (waere intransparent);
  // die UI kann sie vor Submit per Defaultwert vorbelegen.
  const { data, error } = await sb
    .from("companies")
    .insert({
      name: input.name,
      type: "sonstige",
      status: "lead",
      priority: "mittel",
      parent_company_id: input.parent_company_id,
      is_group: false,
      location_label: input.location_label ?? null,
      city: input.city ?? null,
      address: input.address ?? null,
      notes: input.notes ?? null,
    })
    .select("id")
    .single();
  if (error) throw error;

  // Parent automatisch als Gruppe markieren, falls noch nicht gesetzt.
  await sb
    .from("companies")
    .update({ is_group: true })
    .eq("id", input.parent_company_id)
    .eq("is_group", false);

  revalidatePath(`/companies/${input.parent_company_id}`);
  revalidatePath("/companies");
  return data.id as string;
}
