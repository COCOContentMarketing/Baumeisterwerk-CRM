import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type {
  AppUser,
  Company,
  Contact,
  Interaction,
  Priority,
  Recommendation,
} from "@/types/db";

// JS-Sortierung statt PostgREST .order(): Wir vermeiden so saemtliche
// Sortier-bezogenen URL-/Schema-Cache-Quirks (PGRST125 wurde u.a. bei
// chained .order()-Calls gegen Enum-Spalten beobachtet). Die Listen sind
// fuer Single-User-CRM klein genug, dass JS-Sort vernachlaessigbar ist.

const PRIORITY_RANK: Record<Priority, number> = { hoch: 3, mittel: 2, niedrig: 1 };

function byPriorityThenName<T extends { priority: Priority; name: string }>(a: T, b: T): number {
  return PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority] || a.name.localeCompare(b.name, "de");
}

function byOccurredAtAsc<T extends { occurred_at: string }>(a: T, b: T): number {
  return a.occurred_at.localeCompare(b.occurred_at);
}

function byLastNameAsc<T extends { last_name: string | null; is_primary?: boolean }>(a: T, b: T): number {
  const ap = a.is_primary ? 0 : 1;
  const bp = b.is_primary ? 0 : 1;
  return ap - bp || (a.last_name ?? "").localeCompare(b.last_name ?? "", "de");
}

// In single-user mode laden wir den (einzigen) User aus app_user.
export async function getCurrentUser(): Promise<AppUser | null> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("app_user")
    .select("*")
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data as AppUser | null;
}

export async function listCompanies(): Promise<Company[]> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb.from("companies").select("*");
  if (error) throw error;
  const list = (data ?? []) as Company[];
  return list.sort(byPriorityThenName);
}

export async function getCompany(id: string): Promise<Company | null> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb.from("companies").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data as Company | null;
}

export async function listContactsForCompany(companyId: string): Promise<Contact[]> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb.from("contacts").select("*").eq("company_id", companyId);
  if (error) throw error;
  const list = (data ?? []) as Contact[];
  return list.sort(byLastNameAsc);
}

// Listet alle Kontakte und haengt das Unternehmen via separaten Lookup an.
// Keine PostgREST-Embed-Joins, weil diese bei aktiven Schema-Caches
// PGRST125 ausloesen koennen.
export async function listAllContacts(): Promise<(Contact & { company: Company })[]> {
  const sb = getSupabaseAdmin();
  const { data: contacts, error } = await sb.from("contacts").select("*");
  if (error) throw error;
  const list = (contacts ?? []) as Contact[];
  if (list.length === 0) return [];

  const companyIds = Array.from(new Set(list.map((c) => c.company_id)));
  const { data: companies, error: cErr } = await sb
    .from("companies")
    .select("*")
    .in("id", companyIds);
  if (cErr) throw cErr;
  const cMap = new Map(((companies ?? []) as Company[]).map((c) => [c.id, c]));
  return list
    .map((c) => {
      const company = cMap.get(c.company_id);
      return company ? { ...c, company } : null;
    })
    .filter((x): x is Contact & { company: Company } => x !== null)
    .sort((a, b) => a.company.name.localeCompare(b.company.name, "de") || byLastNameAsc(a, b));
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
  const c = contact as Contact;
  const { data: company, error: cErr } = await sb
    .from("companies")
    .select("*")
    .eq("id", c.company_id)
    .maybeSingle();
  if (cErr) throw cErr;
  if (!company) return null;
  return { ...c, company: company as Company };
}

export async function listInteractionsForCompany(companyId: string): Promise<Interaction[]> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb.from("interactions").select("*").eq("company_id", companyId);
  if (error) throw error;
  return ((data ?? []) as Interaction[]).sort(byOccurredAtAsc);
}

export async function listInteractionsForContact(contactId: string): Promise<Interaction[]> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb.from("interactions").select("*").eq("contact_id", contactId);
  if (error) throw error;
  return ((data ?? []) as Interaction[]).sort(byOccurredAtAsc);
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
    .eq("status", "offen");
  if (error) throw error;
  const list = (recs ?? []) as Recommendation[];
  const sorted = list.sort((a, b) => {
    const p = PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority];
    if (p !== 0) return p;
    if (a.due_at && b.due_at) return a.due_at.localeCompare(b.due_at);
    if (a.due_at) return -1;
    if (b.due_at) return 1;
    return 0;
  });
  return await attachRefs(sorted);
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

  const cMap = new Map(((companiesRes.data ?? []) as Company[]).map((c) => [c.id, c]));
  const pMap = new Map(((contactsRes.data ?? []) as Contact[]).map((c) => [c.id, c]));

  return recs.map((r) => ({
    ...r,
    company: r.company_id ? cMap.get(r.company_id) ?? null : null,
    contact: r.contact_id ? pMap.get(r.contact_id) ?? null : null,
  }));
}
