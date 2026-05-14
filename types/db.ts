// Datenbank-Typen, manuell gepflegt (vereinfacht).
// Bei Schema-Aenderungen hier mit anpassen oder via `supabase gen types` generieren.

export type CompanyType =
  | "interior_designer"
  | "handwerker"
  | "hotel"
  | "makler"
  | "relocation"
  | "architekt"
  | "sonstige";

export const COMPANY_TYPE_LABELS: Record<CompanyType, string> = {
  interior_designer: "Interior Designer",
  handwerker: "Handwerker",
  hotel: "Hotel",
  makler: "Makler",
  relocation: "Relocation Service",
  architekt: "Architekt",
  sonstige: "Sonstige",
};

export type CompanyStatus =
  | "lead"
  | "kontaktiert"
  | "in_gespraech"
  | "kunde"
  | "pausiert"
  | "verloren";

export const COMPANY_STATUS_LABELS: Record<CompanyStatus, string> = {
  lead: "Lead",
  kontaktiert: "Kontaktiert",
  in_gespraech: "In Gespräch",
  kunde: "Kunde",
  pausiert: "Pausiert",
  verloren: "Verloren",
};

export type Priority = "niedrig" | "mittel" | "hoch";

export type ContactLanguage = "de" | "en";

export type InteractionType =
  | "email_sent"
  | "email_received"
  | "email_draft"
  | "call"
  | "meeting"
  | "note"
  | "task_done";

export const INTERACTION_TYPE_LABELS: Record<InteractionType, string> = {
  email_sent: "Email gesendet",
  email_received: "Email empfangen",
  email_draft: "Email-Entwurf",
  call: "Telefonat",
  meeting: "Termin",
  note: "Notiz",
  task_done: "Aufgabe erledigt",
};

export type InteractionDirection = "outbound" | "inbound" | "internal";

export type RecommendationKind = "email" | "call" | "meeting" | "follow_up" | "research";
export type RecommendationStatus = "offen" | "erledigt" | "verworfen" | "aufgeschoben";

export interface Company {
  id: string;
  owner_id: string | null;
  name: string;
  type: CompanyType;
  status: CompanyStatus;
  priority: Priority;
  website: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
  notes: string | null;
  tags: string[] | null;
  last_interaction_at: string | null;
  next_action_at: string | null;
  parent_company_id: string | null;
  is_group: boolean;
  location_label: string | null;
  created_at: string;
  updated_at: string;
}

export interface ContactCompanyLink {
  id: string;
  contact_id: string;
  company_id: string;
  is_primary: boolean;
  role: string | null;
  owner_id: string | null;
  created_at: string;
  updated_at: string;
}

// Aus der SQL-View companies_with_rollup (Migration 0011): Company plus
// effective_last_interaction_at, das fuer Dach-Companies das spaeteste
// last_interaction_at ueber alle Children-Standorte hochrollt.
export interface CompanyWithRollup extends Company {
  effective_last_interaction_at: string | null;
}

export interface Contact {
  id: string;
  company_id: string;
  owner_id: string | null;
  first_name: string | null;
  last_name: string | null;
  full_name: string | null;
  role: string | null;
  email: string | null;
  phone: string | null;
  language: ContactLanguage;
  linkedin_url: string | null;
  notes: string | null;
  is_primary: boolean;
  last_interaction_at: string | null;
  email_invalid: boolean;
  email_invalid_since: string | null;
  email_invalid_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface Interaction {
  id: string;
  owner_id: string | null;
  company_id: string;
  contact_id: string | null;
  type: InteractionType;
  direction: InteractionDirection;
  subject: string | null;
  body: string | null;
  occurred_at: string;
  gmail_message_id: string | null;
  gmail_thread_id: string | null;
  gmail_draft_id: string | null;
  metadata: Record<string, unknown> | null;
  ai_classification: Record<string, unknown>;
  is_bounce: boolean;
  bounce_reason: string | null;
  created_at: string;
}

export interface Recommendation {
  id: string;
  owner_id: string | null;
  company_id: string | null;
  contact_id: string | null;
  kind: RecommendationKind;
  status: RecommendationStatus;
  priority: Priority;
  title: string;
  reason: string | null;
  due_at: string | null;
  draft_subject: string | null;
  draft_body: string | null;
  call_briefing: string | null;
  ai_model: string | null;
  ai_generated_at: string | null;
  resulting_interaction_id: string | null;
  source_interaction_id: string | null;
  gmail_draft_id: string | null;
  snoozed_until: string | null;
  created_at: string;
  updated_at: string;
}

export interface AppUser {
  id: string;
  email: string;
  display_name: string | null;
  signature: string | null;
  gmail_refresh_token: string | null;
  gmail_account_email: string | null;
  gmail_last_history_id: string | null;
  gmail_scopes: string[] | null;
  digest_email: string | null;
  digest_enabled: boolean;
  digest_last_sent_at: string | null;
  digest_timezone: string;
  created_at: string;
  updated_at: string;
}
