import { getSupabaseAdmin } from "@/lib/supabase/admin";
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

// Listet alle Kontakte und haengt das Unternehmen via Lookup an. Wir vermeiden
// PostgREST-Embed-Joins, weil diese in einigen Konstellationen PGRST125
// ausloesen koennen.
export async function listAllContacts(): Promise<(Contact & { company: Company })[]> {
  const sb = getSupabaseAdmin();
  const { data: contacts, error } = await sb
    .from("contacts")
    .select("*")
    .order("last_name", { ascending: true });
  if (error) throw error;
  const list = (contacts ?? []) as Contact[];
  if (list.length === 0) return [];

  const companyIds = Array.from(new Set(list.map((c) => c.company_id)));
  const { data: companies, error: cErr } = await sb
    .from("companies")
    .select("*")
    .in("id", companyIds);
  if (cErr) throw cErr;
  const cMap = new Map((companies ?? []).map((c) => [c.id as string, c as Company]));
  return list
    .map((c) => {
      const company = cMap.get(c.company_id);
      if (!company) return null;
      return { ...c, company };
    })
    .filter((x): x is Contact & { company: Company } => x !== null);
}

export async function getContact(id: string): Promise<(Contact & { company: Company }) | null> {
  const sb = getSupabaseAdmin();
  const { data: contact, error } = await sb
    .from("contacts")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!contact) return null;
  const { data: company, error: cErr } = await sb
    .from("companies")
    .select("*")
    .eq("id", (contact as Contact).company_id)
    .maybeSingle();
  if (cErr) throw cErr;
  if (!company) return null;
  return { ...(contact as Contact), company: company as Company };
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

export type RecommendationWithRefs = Recommendation & {
  company: Company | null;
  contact: Contact | null;
};

export async function listOpenRecommendations(): Promise<RecommendationWithRefs[]> {
  const sb = getSupabaseAdmin();
  const { data: recs, error } = await sb
    .from("recommendations")
    .select("*")
    .eq("status", "offen")
    .order("priority", { ascending: false })
    .order("due_at", { ascending: true });
  if (error) throw error;
  const list = (recs ?? []) as Recommendation[];
  return await attachRefs(list);
}

export async function getRecommendation(id: string): Promise<RecommendationWithRefs | null> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("recommendations")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const [withRefs] = await attachRefs([data as Recommendation]);
  return withRefs;
}

async function attachRefs(recs: Recommendation[]): Promise<RecommendationWithRefs[]> {
  if (recs.length === 0) return [];
  const sb = getSupabaseAdmin();

  const companyIds = Array.from(
    new Set(recs.map((r) => r.company_id).filter((x): x is string => !!x)),
  );
  const contactIds = Array.from(
    new Set(recs.map((r) => r.contact_id).filter((x): x is string => !!x)),
  );

  const [companiesRes, contactsRes] = await Promise.all([
    companyIds.length > 0
      ? sb.from("companies").select("*").in("id", companyIds)
      : Promise.resolve({ data: [] as Company[], error: null }),
    contactIds.length > 0
      ? sb.from("contacts").select("*").in("id", contactIds)
      : Promise.resolve({ data: [] as Contact[], error: null }),
  ]);
  if (companiesRes.error) throw companiesRes.error;
  if (contactsRes.error) throw contactsRes.error;

  const cMap = new Map(
    ((companiesRes.data ?? []) as Company[]).map((c) => [c.id, c]),
  );
  const pMap = new Map(
    ((contactsRes.data ?? []) as Contact[]).map((c) => [c.id, c]),
  );

  return recs.map((r) => ({
    ...r,
    company: r.company_id ? cMap.get(r.company_id) ?? null : null,
    contact: r.contact_id ? pMap.get(r.contact_id) ?? null : null,
  }));
}
