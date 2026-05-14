import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type {
  AppUser,
  Company,
  CompanyWithRollup,
  Contact,
  ContactCompanyLink,
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

export type CompanyView = "all" | "groups" | "leafs";

export async function listCompanies(view: CompanyView = "all"): Promise<CompanyWithRollup[]> {
  const sb = getSupabaseAdmin();
  // Liest aus der View companies_with_rollup (Migration 0011): liefert
  // zusaetzlich effective_last_interaction_at, das fuer Dach-Companies das
  // spaeteste last_interaction_at ueber alle Children-Standorte hochrollt.
  const { data, error } = await sb.from("companies_with_rollup").select("*");
  if (error) throw error;
  const list = (data ?? []) as CompanyWithRollup[];
  const filtered =
    view === "groups"
      ? list.filter((c) => c.is_group)
      : view === "leafs"
        ? list.filter((c) => !!c.parent_company_id)
        : list;
  return filtered.sort(byPriorityThenName);
}

export async function listLocations(parentCompanyId: string): Promise<Company[]> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("companies")
    .select("*")
    .eq("parent_company_id", parentCompanyId);
  if (error) throw error;
  const list = (data ?? []) as Company[];
  return list.sort((a, b) =>
    (a.location_label ?? a.name).localeCompare(b.location_label ?? b.name, "de"),
  );
}

export async function getCompany(id: string): Promise<Company | null> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb.from("companies").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data as Company | null;
}

/** Kontakt-Sicht aus einer Standort-Perspektive (Link-basiert). */
export type ContactForCompany = Contact & {
  link_id: string;
  link_is_primary: boolean;
  link_role: string | null;
};

export async function listContactsForCompany(companyId: string): Promise<ContactForCompany[]> {
  const sb = getSupabaseAdmin();
  // Quelle der Wahrheit: contact_company_links. Anker-Spalte contacts.company_id
  // wird ignoriert - was zaehlt, ist der Link an die jeweilige Company.
  const { data: linkRows, error: lErr } = await sb
    .from("contact_company_links")
    .select("*")
    .eq("company_id", companyId);
  if (lErr) throw lErr;
  const links = (linkRows ?? []) as ContactCompanyLink[];
  if (links.length === 0) return [];

  const contactIds = links.map((l) => l.contact_id);
  const { data: contacts, error: cErr } = await sb
    .from("contacts")
    .select("*")
    .in("id", contactIds);
  if (cErr) throw cErr;
  const cMap = new Map(((contacts ?? []) as Contact[]).map((c) => [c.id, c]));

  const merged: ContactForCompany[] = links
    .map((l) => {
      const c = cMap.get(l.contact_id);
      return c
        ? {
            ...c,
            link_id: l.id,
            link_is_primary: l.is_primary,
            link_role: l.role,
          }
        : null;
    })
    .filter((x): x is ContactForCompany => x !== null);

  return merged.sort((a, b) => {
    const ap = a.link_is_primary ? 0 : 1;
    const bp = b.link_is_primary ? 0 : 1;
    return ap - bp || (a.last_name ?? "").localeCompare(b.last_name ?? "", "de");
  });
}

export async function getPrimaryContactForCompany(
  companyId: string,
): Promise<Contact | null> {
  const sb = getSupabaseAdmin();
  const { data: link, error: lErr } = await sb
    .from("contact_company_links")
    .select("contact_id")
    .eq("company_id", companyId)
    .eq("is_primary", true)
    .maybeSingle();
  if (lErr) throw lErr;
  if (!link?.contact_id) return null;
  const { data: contact, error: cErr } = await sb
    .from("contacts")
    .select("*")
    .eq("id", link.contact_id)
    .maybeSingle();
  if (cErr) throw cErr;
  return contact as Contact | null;
}

export type CompanyForContact = Company & {
  link_id: string;
  link_is_primary: boolean;
  link_role: string | null;
};

export async function listCompaniesForContact(
  contactId: string,
): Promise<CompanyForContact[]> {
  const sb = getSupabaseAdmin();
  const { data: linkRows, error: lErr } = await sb
    .from("contact_company_links")
    .select("*")
    .eq("contact_id", contactId);
  if (lErr) throw lErr;
  const links = (linkRows ?? []) as ContactCompanyLink[];
  if (links.length === 0) return [];

  const companyIds = links.map((l) => l.company_id);
  const { data: companies, error: cErr } = await sb
    .from("companies")
    .select("*")
    .in("id", companyIds);
  if (cErr) throw cErr;
  const coMap = new Map(((companies ?? []) as Company[]).map((c) => [c.id, c]));

  return links
    .map((l) => {
      const c = coMap.get(l.company_id);
      return c
        ? {
            ...c,
            link_id: l.id,
            link_is_primary: l.is_primary,
            link_role: l.role,
          }
        : null;
    })
    .filter((x): x is CompanyForContact => x !== null)
    .sort((a, b) => a.name.localeCompare(b.name, "de"));
}

/** Alle Links als Map fuer die Recommendations-Engine (n:m). */
export async function listAllContactCompanyLinks(): Promise<ContactCompanyLink[]> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb.from("contact_company_links").select("*");
  if (error) throw error;
  return (data ?? []) as ContactCompanyLink[];
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

export type InboxItem = Interaction & {
  contact: Contact | null;
  company: Company | null;
  open_recommendation: { id: string; kind: string; priority: Priority } | null;
};

// Inbox-View: Inbound-Mails der letzten Tage, jeweils mit dem Status der
// dazu offenen Reply-Recommendation. "Erledigt" wird ueber die Recommendation
// gesteuert (kein eigenes Flag auf interactions).
export async function listInboxItems(): Promise<InboxItem[]> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("interactions")
    .select("*")
    .eq("type", "email_received")
    .eq("is_bounce", false);
  if (error) throw error;
  const list = (data ?? []) as Interaction[];
  if (list.length === 0) return [];

  const sorted = list.sort((a, b) => b.occurred_at.localeCompare(a.occurred_at)).slice(0, 100);

  const contactIds = Array.from(
    new Set(sorted.map((i) => i.contact_id).filter((x): x is string => !!x)),
  );
  const companyIds = Array.from(new Set(sorted.map((i) => i.company_id)));
  const interactionIds = sorted.map((i) => i.id);

  const [contactsRes, companiesRes, recosRes] = await Promise.all([
    contactIds.length > 0
      ? sb.from("contacts").select("*").in("id", contactIds)
      : Promise.resolve({ data: [] as Contact[], error: null }),
    companyIds.length > 0
      ? sb.from("companies").select("*").in("id", companyIds)
      : Promise.resolve({ data: [] as Company[], error: null }),
    interactionIds.length > 0
      ? sb
          .from("recommendations")
          .select("id, kind, priority, source_interaction_id, status")
          .in("source_interaction_id", interactionIds)
          .eq("status", "offen")
      : Promise.resolve({
          data: [] as {
            id: string;
            kind: string;
            priority: Priority;
            source_interaction_id: string;
            status: string;
          }[],
          error: null,
        }),
  ]);
  if (contactsRes.error) throw contactsRes.error;
  if (companiesRes.error) throw companiesRes.error;
  if (recosRes.error) throw recosRes.error;

  const pMap = new Map(((contactsRes.data ?? []) as Contact[]).map((c) => [c.id, c]));
  const coMap = new Map(((companiesRes.data ?? []) as Company[]).map((c) => [c.id, c]));
  type RecoRow = {
    id: string;
    kind: string;
    priority: Priority;
    source_interaction_id: string | null;
  };
  const rMap = new Map<string, RecoRow>();
  for (const r of (recosRes.data ?? []) as RecoRow[]) {
    if (r.source_interaction_id) rMap.set(r.source_interaction_id, r);
  }

  return sorted.map((i) => {
    const reco = rMap.get(i.id);
    return {
      ...i,
      contact: i.contact_id ? pMap.get(i.contact_id) ?? null : null,
      company: coMap.get(i.company_id) ?? null,
      open_recommendation: reco
        ? { id: reco.id, kind: reco.kind, priority: reco.priority }
        : null,
    };
  });
}

export async function getInteraction(id: string): Promise<Interaction | null> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("interactions")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data as Interaction | null;
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
