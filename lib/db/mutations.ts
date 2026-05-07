"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabase/server";
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
