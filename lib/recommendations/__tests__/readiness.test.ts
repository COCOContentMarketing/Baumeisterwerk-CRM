import { describe, it, expect } from "vitest";
import {
  classifyReadiness,
  parseReadinessView,
  readinessCounts,
  type Readiness,
} from "../readiness";

const NOW = new Date("2026-05-13T10:00:00Z");

function future(daysFromNow: number): string {
  return new Date(NOW.getTime() + daysFromNow * 86400_000).toISOString();
}
function past(daysAgo: number): string {
  return new Date(NOW.getTime() - daysAgo * 86400_000).toISOString();
}

function contact(overrides: Partial<{ email: string | null; phone: string | null; email_invalid: boolean }> = {}) {
  return {
    email: "kontakt@example.com",
    phone: null,
    email_invalid: false,
    ...overrides,
  };
}

describe("classifyReadiness", () => {
  it("bereit: Email-Reco mit gueltigem Kontakt + keine Snooze", () => {
    const r = classifyReadiness({
      recommendation: { kind: "email", snoozed_until: null },
      contact: contact(),
      now: NOW,
    });
    expect(r).toBe<Readiness>("bereit");
  });

  it("recherche: Email-Reco ohne Kontakt", () => {
    const r = classifyReadiness({
      recommendation: { kind: "email", snoozed_until: null },
      contact: null,
      now: NOW,
    });
    expect(r).toBe("recherche");
  });

  it("recherche: Email-Reco mit Kontakt ohne Email", () => {
    const r = classifyReadiness({
      recommendation: { kind: "email", snoozed_until: null },
      contact: contact({ email: null }),
      now: NOW,
    });
    expect(r).toBe("recherche");
  });

  it("recherche: Email-Reco mit ungueltiger Email (Bounce)", () => {
    const r = classifyReadiness({
      recommendation: { kind: "email", snoozed_until: null },
      contact: contact({ email_invalid: true }),
      now: NOW,
    });
    expect(r).toBe("recherche");
  });

  it("wartend: snoozed_until in der Zukunft", () => {
    const r = classifyReadiness({
      recommendation: { kind: "email", snoozed_until: future(3) },
      contact: contact(),
      now: NOW,
    });
    expect(r).toBe("wartend");
  });

  it("bereit: snoozed_until in der Vergangenheit (auto-aufgewacht)", () => {
    const r = classifyReadiness({
      recommendation: { kind: "email", snoozed_until: past(1) },
      contact: contact(),
      now: NOW,
    });
    expect(r).toBe("bereit");
  });

  it("Snooze hat Vorrang vor Recherche-Indikatoren", () => {
    // Auch wenn die Email ungueltig ist: solange der Reco gesnoozed ist,
    // gehoert er in die Wartend-Liste.
    const r = classifyReadiness({
      recommendation: { kind: "email", snoozed_until: future(2) },
      contact: contact({ email_invalid: true }),
      now: NOW,
    });
    expect(r).toBe("wartend");
  });

  it("research-Recos sind immer bereit (auch ohne Kontakt)", () => {
    const r = classifyReadiness({
      recommendation: { kind: "research", snoozed_until: null },
      contact: null,
      now: NOW,
    });
    expect(r).toBe("bereit");
  });

  it("call-Recos brauchen eine Telefonnummer", () => {
    const noPhone = classifyReadiness({
      recommendation: { kind: "call", snoozed_until: null },
      contact: contact({ phone: null }),
      now: NOW,
    });
    expect(noPhone).toBe("recherche");

    const withPhone = classifyReadiness({
      recommendation: { kind: "call", snoozed_until: null },
      contact: contact({ phone: "+49 0151 1234567" }),
      now: NOW,
    });
    expect(withPhone).toBe("bereit");
  });

  it("follow_up ohne harte Datenanforderung gilt als bereit", () => {
    const r = classifyReadiness({
      recommendation: { kind: "follow_up", snoozed_until: null },
      contact: null,
      now: NOW,
    });
    expect(r).toBe("bereit");
  });

  it("ungueltiger snoozed_until-String wird wie kein Snooze behandelt", () => {
    const r = classifyReadiness({
      recommendation: { kind: "email", snoozed_until: "not-a-date" },
      contact: contact(),
      now: NOW,
    });
    expect(r).toBe("bereit");
  });
});

describe("readinessCounts", () => {
  it("zaehlt pro Kategorie korrekt und liefert eine alle-Summe", () => {
    const counts = readinessCounts([
      { readiness: "bereit" },
      { readiness: "bereit" },
      { readiness: "recherche" },
      { readiness: "wartend" },
    ]);
    expect(counts.alle).toBe(4);
    expect(counts.bereit).toBe(2);
    expect(counts.recherche).toBe(1);
    expect(counts.wartend).toBe(1);
  });

  it("leere Liste -> alle Zaehler 0", () => {
    const counts = readinessCounts([]);
    expect(counts).toEqual({ alle: 0, bereit: 0, recherche: 0, wartend: 0 });
  });
});

describe("parseReadinessView", () => {
  it("Default ohne Param ist 'bereit'", () => {
    expect(parseReadinessView(undefined)).toBe("bereit");
    expect(parseReadinessView("")).toBe("bereit");
  });

  it("Unbekannte Werte fallen auf 'bereit' zurueck", () => {
    expect(parseReadinessView("foobar")).toBe("bereit");
  });

  it("Gueltige Werte werden uebernommen", () => {
    expect(parseReadinessView("alle")).toBe("alle");
    expect(parseReadinessView("recherche")).toBe("recherche");
    expect(parseReadinessView("wartend")).toBe("wartend");
  });
});
