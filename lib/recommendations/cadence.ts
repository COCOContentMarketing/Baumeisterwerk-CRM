// B2B-Kontaktzyklen für Baumeisterwerk-Outreach.
//
// Diese Datei kapselt die Geschaeftsregeln dafuer, WANN ein Kontakt wieder
// angesprochen werden sollte. Sie ist die Logik, die der Daily-Digest und
// die "Empfehlungen generieren"-Funktion verwenden.
//
// Grundsaetze:
//   - Initialkontakt mit klarem Wertversprechen
//   - Erster Follow-up nach 7-10 Tagen (kein Druck, neue Info)
//   - Zweiter Follow-up nach weiteren 14 Tagen (letzte direkte Anfrage)
//   - Dann Pause; Re-Engagement nach 90 Tagen mit neuem Anlass
//   - Nach Antwort/Termin: Verbindlichkeit zeitnah halten (24-48h Dank,
//     7 Tage konkretes Follow-up)
//   - Aktive Kunden: 30-Tage-Touchbase

import type {
  Company,
  Contact,
  Interaction,
  Priority,
  RecommendationKind,
} from "@/types/db";

export interface PendingAction {
  contact: Contact;
  company: Company;
  kind: RecommendationKind;
  priority: Priority;
  title: string;
  reason: string;
  due_at: string;
  // Vorlage, die als Basis fuer die KI-Generierung dient.
  template_use_case: string;
}

export interface CadenceInput {
  company: Company;
  contact: Contact;
  interactions: Interaction[];
  now: Date;
}

const DAY = 24 * 60 * 60 * 1000;

const CADENCE = {
  firstFollowUpAfterDays: 8,
  secondFollowUpAfterDays: 14,
  reEngagementAfterDays: 90,
  thankYouWithinHours: 48,
  postMeetingFollowUpDays: 7,
  activeKundeTouchbaseDays: 30,
} as const;

export function evaluateContact(input: CadenceInput): PendingAction | null {
  const { company, contact, interactions, now } = input;
  if (company.status === "verloren" || company.status === "pausiert") return null;

  const sortedDesc = [...interactions].sort((a, b) =>
    b.occurred_at.localeCompare(a.occurred_at),
  );
  const last = sortedDesc[0] ?? null;
  const lastOutbound = sortedDesc.find((i) => i.direction === "outbound") ?? null;
  const lastInbound = sortedDesc.find((i) => i.direction === "inbound") ?? null;
  const lastMeeting = sortedDesc.find((i) => i.type === "meeting") ?? null;
  const outboundCount = sortedDesc.filter((i) => i.direction === "outbound").length;
  const hasInboundAfter = (since: string) =>
    sortedDesc.some((i) => i.direction === "inbound" && i.occurred_at > since);

  // 1. Frischer Termin oder Anruf -> Dankesnachricht / Folgeschritt zeitnah
  if (lastMeeting) {
    const ageHrs = (now.getTime() - new Date(lastMeeting.occurred_at).getTime()) / 36e5;
    if (ageHrs < CADENCE.thankYouWithinHours) {
      return {
        contact,
        company,
        kind: "follow_up",
        priority: "hoch",
        title: `Kurzes Danke nach Termin mit ${displayName(contact)}`,
        reason: `Termin am ${shortDate(lastMeeting.occurred_at)}. Innerhalb von 48h kurz Danke + Bestaetigung der Naechsten Schritte.`,
        due_at: addDays(now, 0).toISOString(),
        template_use_case: "post_meeting_thanks",
      };
    }
    const ageDays = Math.floor(
      (now.getTime() - new Date(lastMeeting.occurred_at).getTime()) / DAY,
    );
    if (
      ageDays >= CADENCE.postMeetingFollowUpDays &&
      !hasInboundAfter(lastMeeting.occurred_at)
    ) {
      return {
        contact,
        company,
        kind: "follow_up",
        priority: "hoch",
        title: `Substanzieller Follow-up zu Termin mit ${displayName(contact)}`,
        reason: `Termin liegt ${ageDays} Tage zurueck, keine Reaktion seither. Konkretes Naechste-Schritte-Angebot machen.`,
        due_at: now.toISOString(),
        template_use_case: "post_meeting_follow_up",
      };
    }
  }

  // 2. Inbound erhalten und noch nicht beantwortet
  if (lastInbound && (!lastOutbound || lastInbound.occurred_at > lastOutbound.occurred_at)) {
    const ageHrs = (now.getTime() - new Date(lastInbound.occurred_at).getTime()) / 36e5;
    if (ageHrs > 4) {
      return {
        contact,
        company,
        kind: "email",
        priority: "hoch",
        title: `Antwort an ${displayName(contact)} ausstehend`,
        reason: `${displayName(contact)} hat am ${shortDate(lastInbound.occurred_at)} geschrieben und noch keine Antwort erhalten.`,
        due_at: now.toISOString(),
        template_use_case: "inbound_reply",
      };
    }
    return null;
  }

  // 3. Aktiver Kunde: regelmaessiger Touchbase
  if (company.status === "kunde") {
    if (!last) {
      return {
        contact,
        company,
        kind: "follow_up",
        priority: "mittel",
        title: `Touchbase mit Bestandskunde ${company.name}`,
        reason: "Aktiver Kunde, noch keine Interaktion erfasst.",
        due_at: now.toISOString(),
        template_use_case: "kunde_touchbase",
      };
    }
    const ageDays = Math.floor((now.getTime() - new Date(last.occurred_at).getTime()) / DAY);
    if (ageDays >= CADENCE.activeKundeTouchbaseDays) {
      return {
        contact,
        company,
        kind: "follow_up",
        priority: "mittel",
        title: `Touchbase mit ${company.name}`,
        reason: `Letzter Kontakt vor ${ageDays} Tagen. Kurzer Update-Impuls hilft die Beziehung warm zu halten.`,
        due_at: now.toISOString(),
        template_use_case: "kunde_touchbase",
      };
    }
    return null;
  }

  // 4. Noch keine Outbound -> Erstkontakt
  if (!lastOutbound) {
    return {
      contact,
      company,
      kind: "email",
      priority: company.priority,
      title: `Erstkontakt-Email an ${displayName(contact)}${
        company.type === "makler" ? "" : ""
      }`,
      reason:
        company.notes?.includes("TOP-PRIORITÄT")
          ? "Top-Prioritaet: zuerst kontaktieren."
          : "Noch kein Kontakt aufgenommen.",
      due_at: now.toISOString(),
      template_use_case: defaultTemplateForCompany(company),
    };
  }

  // 5. Outbound liegt zurueck, keine Antwort -> Follow-up-Stufen
  const since = lastOutbound.occurred_at;
  if (hasInboundAfter(since)) return null; // wurde schon beantwortet
  const ageDays = Math.floor((now.getTime() - new Date(since).getTime()) / DAY);

  if (outboundCount === 1 && ageDays >= CADENCE.firstFollowUpAfterDays) {
    return {
      contact,
      company,
      kind: "email",
      priority: company.priority,
      title: `1. Follow-up an ${displayName(contact)}`,
      reason: `Erstkontakt am ${shortDate(since)} ohne Antwort (vor ${ageDays} Tagen).`,
      due_at: now.toISOString(),
      template_use_case: "follow_up_1",
    };
  }
  if (outboundCount === 2 && ageDays >= CADENCE.secondFollowUpAfterDays) {
    return {
      contact,
      company,
      kind: "email",
      priority: downgradePriority(company.priority),
      title: `2. Follow-up an ${displayName(contact)}`,
      reason: `Zwei Anschreiben ohne Reaktion. Letzter Versuch mit klarem Schluss.`,
      due_at: now.toISOString(),
      template_use_case: "follow_up_2",
    };
  }
  if (outboundCount >= 3 && ageDays >= CADENCE.reEngagementAfterDays) {
    return {
      contact,
      company,
      kind: "email",
      priority: "niedrig",
      title: `Re-Engagement nach Pause: ${displayName(contact)}`,
      reason: `Letzte Outbound-Mail vor ${ageDays} Tagen. Mit neuem Anlass (Referenz, Saison, News) reaktivieren.`,
      due_at: now.toISOString(),
      template_use_case: "re_engagement",
    };
  }

  return null;
}

function displayName(c: Contact): string {
  return c.full_name?.trim() || c.email || "Kontakt";
}

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function addDays(d: Date, days: number): Date {
  return new Date(d.getTime() + days * DAY);
}

function downgradePriority(p: Priority): Priority {
  if (p === "hoch") return "mittel";
  if (p === "mittel") return "niedrig";
  return "niedrig";
}

function defaultTemplateForCompany(c: Company): string {
  if (c.type === "makler") return "anschreiben_makler_erstkontakt";
  if (c.type === "relocation") return "anschreiben_relocation_erstkontakt";
  if (c.type === "interior_designer") return "anschreiben_interior_designer_erstkontakt";
  if (c.type === "hotel") return "anschreiben_hotel_erstkontakt";
  if (c.type === "handwerker") return "anschreiben_handwerker_erstkontakt";
  if (c.type === "architekt") return "anschreiben_architekt_erstkontakt";
  return "anschreiben_generic_erstkontakt";
}
