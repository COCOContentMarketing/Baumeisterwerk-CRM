import type { Contact, Recommendation, RecommendationKind } from "@/types/db";

// "bereit"    -> kann direkt abgearbeitet werden
// "recherche" -> Empfehlung haengt an Daten, die noch fehlen oder ungueltig sind
// "wartend"   -> snoozed_until in der Zukunft
export type Readiness = "bereit" | "recherche" | "wartend";

export type ReadinessView = "alle" | Readiness;

export interface ReadinessInputs {
  recommendation: Pick<Recommendation, "kind" | "snoozed_until">;
  contact: Pick<Contact, "email" | "phone" | "email_invalid"> | null;
  now: Date;
}

export function classifyReadiness({ recommendation, contact, now }: ReadinessInputs): Readiness {
  // 1) Snooze hat Vorrang: explizit "wartend" bis der Termin in der
  //    Vergangenheit liegt.
  if (recommendation.snoozed_until) {
    const until = new Date(recommendation.snoozed_until).getTime();
    if (!Number.isNaN(until) && until > now.getTime()) return "wartend";
  }

  // 2) research-Empfehlungen sind selbst die Recherche-Action und somit
  //    immer "bereit" - unabhaengig davon, ob ein Kontakt vorhanden ist.
  if (recommendation.kind === "research") return "bereit";

  // 3) Email-Empfehlungen brauchen einen Kontakt mit gueltiger Email.
  if (isEmailKind(recommendation.kind)) {
    if (!contact) return "recherche";
    if (!contact.email) return "recherche";
    if (contact.email_invalid) return "recherche";
    return "bereit";
  }

  // 4) Telefon-Empfehlungen brauchen eine Telefonnummer.
  if (recommendation.kind === "call") {
    if (!contact || !contact.phone) return "recherche";
    return "bereit";
  }

  // 5) Alles andere (follow_up, meeting, ...) gilt als bereit, sobald
  //    nicht gesnoozed - es sind allgemeine Folgeaktionen ohne harte
  //    Daten-Voraussetzung.
  return "bereit";
}

function isEmailKind(kind: RecommendationKind): boolean {
  // Eigene kleine Liste statt Enum-Switch: spart Update-Pflicht, wenn
  // spaeter neue Kinds dazukommen.
  return kind === "email";
}

/**
 * Liefert eine kompakte Zaehlerzeile pro Readiness-View. Wird vom Dashboard
 * fuer die Filter-Chips genutzt.
 */
export function readinessCounts(
  items: { readiness: Readiness }[],
): Record<ReadinessView, number> {
  const counts: Record<ReadinessView, number> = {
    alle: items.length,
    bereit: 0,
    recherche: 0,
    wartend: 0,
  };
  for (const i of items) counts[i.readiness] += 1;
  return counts;
}

/** Schmaler URL-Param-Parser fuer ?ready= */
export function parseReadinessView(raw: string | undefined): ReadinessView {
  if (raw === "alle" || raw === "recherche" || raw === "wartend") return raw;
  // Default: "bereit" - damit der Nutzer direkt die abarbeitbaren
  // Empfehlungen sieht.
  return "bereit";
}
