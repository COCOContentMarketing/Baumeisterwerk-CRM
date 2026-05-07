import { getSupabaseAdmin } from "@/lib/supabase/server";
import type {
  AppUser,
  Company,
  Contact,
  Interaction,
  Recommendation,
} from "@/types/db";

// In single-user mode laden wir den (einzigen) User aus app_user.
export async function getCurrentUser(): Promise<AppUser | null> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("app_user")
    .select("*")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data as AppUser | null;
}

export async function listCompanies(): Promise<Company[]> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("companies")
    .select("*")
    .order("priority", { ascending: false })
    .order("last_interaction_at", { ascending: false, nullsFirst: false })
    .order("name", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Company[];
}

export async function getCompany(id: string): Promise<Company | null> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb.from("companies").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data as Company | null;
}

export async function listContactsForCompany(companyId: string): Promise<Contact[]> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("contacts")
    .select("*")
    .eq("company_id", companyId)
    .order("is_primary", { ascending: false })
    .order("last_name", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Contact[];
}

export async function listAllContacts(): Promise<(Contact & { company: Company })[]> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("contacts")
    .select("*, company:companies(*)")
    .order("last_interaction_at", { ascending: false, nullsFirst: false });
  if (error) throw error;
  return (data ?? []) as (Contact & { company: Company })[];
}

export async function getContact(id: string): Promise<(Contact & { company: Company }) | null> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("contacts")
    .select("*, company:companies(*)")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data as (Contact & { company: Company }) | null;
}

export async function listInteractionsForCompany(companyId: string): Promise<Interaction[]> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("interactions")
    .select("*")
    .eq("company_id", companyId)
    .order("occurred_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Interaction[];
}

export async function listInteractionsForContact(contactId: string): Promise<Interaction[]> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("interactions")
    .select("*")
    .eq("contact_id", contactId)
    .order("occurred_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Interaction[];
}

export async function listOpenRecommendations(): Promise<
  (Recommendation & { company: Company | null; contact: Contact | null })[]
> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("recommendations")
    .select("*, company:companies(*), contact:contacts(*)")
    .eq("status", "offen")
    .order("priority", { ascending: false })
    .order("due_at", { ascending: true, nullsFirst: false });
  if (error) throw error;
  return (data ?? []) as (Recommendation & { company: Company | null; contact: Contact | null })[];
}

export async function getRecommendation(id: string) {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("recommendations")
    .select("*, company:companies(*), contact:contacts(*)")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data as
    | (Recommendation & { company: Company | null; contact: Contact | null })
    | null;
}
