import { describe, it, expect } from "vitest";
import {
  fixUmlautWorkarounds,
  hasUmlautWorkaround,
  UMLAUT_REPLACEMENTS,
} from "../umlauts";

describe("fixUmlautWorkarounds", () => {
  it("ersetzt einzelne Wort-Stems", () => {
    expect(fixUmlautWorkarounds("persoenlich")).toBe("persönlich");
    expect(fixUmlautWorkarounds("Aufhaenger")).toBe("Aufhänger");
    expect(fixUmlautWorkarounds("Prioritaet")).toBe("Priorität");
    expect(fixUmlautWorkarounds("Bestaetigung")).toBe("Bestätigung");
    expect(fixUmlautWorkarounds("Gespraech")).toBe("Gespräch");
    expect(fixUmlautWorkarounds("Loesung")).toBe("Lösung");
    expect(fixUmlautWorkarounds("Tonalitaet")).toBe("Tonalität");
  });

  it("ersetzt Stems auch als Teil groesserer Woerter", () => {
    expect(fixUmlautWorkarounds("persoenlichem")).toBe("persönlichem");
    expect(fixUmlautWorkarounds("Rueckfrage")).toBe("Rückfrage");
    expect(fixUmlautWorkarounds("zurueck")).toBe("zurück");
    expect(fixUmlautWorkarounds("Naechster Schritt")).toBe("Nächster Schritt");
    expect(fixUmlautWorkarounds("Gespraeche")).toBe("Gespräche");
    expect(fixUmlautWorkarounds("anstossen")).toBe("anstoßen");
  });

  it("ersetzt mehrere Vorkommen in einem realistischen Reco-Titel", () => {
    const input =
      "Erst-Anschreiben an Holzrausch mit persoenlichem Aufhaenger und konkreter Wertaussage verfassen";
    expect(fixUmlautWorkarounds(input)).toBe(
      "Erst-Anschreiben an Holzrausch mit persönlichem Aufhänger und konkreter Wertaussage verfassen",
    );
  });

  it("ersetzt fuer/Fuer und ueber", () => {
    expect(fixUmlautWorkarounds("Vorlage fuer den Erstkontakt")).toBe(
      "Vorlage für den Erstkontakt",
    );
    expect(fixUmlautWorkarounds("Fuer diesen Makler")).toBe("Für diesen Makler");
    expect(fixUmlautWorkarounds("Update ueber den Projektstand")).toBe(
      "Update über den Projektstand",
    );
  });

  it("ist idempotent: zweimal anwenden = einmal anwenden", () => {
    const cases = [
      "persoenlichem Aufhaenger",
      "Rueckfrage von Frau Mueller zu Prioritaet",
      "Erstkontakt fuer Gespraech ueber Loesung",
      "schon korrekt: persönlich, Rückfrage, für",
    ];
    for (const c of cases) {
      const once = fixUmlautWorkarounds(c);
      const twice = fixUmlautWorkarounds(once);
      expect(twice).toBe(once);
    }
  });

  it("zerstoert keine englischen Woerter und korrektes Deutsch (kein pauschales ae->ä)", () => {
    // "Email" enthaelt "ae" - darf NICHT zu "Emäil" werden.
    expect(fixUmlautWorkarounds("Email an den Kontakt senden")).toBe(
      "Email an den Kontakt senden",
    );
    // Korrektes "ss" in "Anlass", "Schluss", "Interesse" bleibt unangetastet.
    expect(fixUmlautWorkarounds("Mit neuem Anlass zum Abschluss")).toBe(
      "Mit neuem Anlass zum Abschluss",
    );
    expect(fixUmlautWorkarounds("Interesse signalisiert")).toBe("Interesse signalisiert");
    // Bereits korrekte Umlaute bleiben unveraendert.
    expect(fixUmlautWorkarounds("persönlicher Aufhänger")).toBe("persönlicher Aufhänger");
  });

  it("laesst Strings ohne Workarounds unveraendert", () => {
    const clean = "Antwort an Frau Schmidt ausstehend";
    expect(fixUmlautWorkarounds(clean)).toBe(clean);
  });
});

describe("hasUmlautWorkaround", () => {
  it("erkennt vorhandene Workarounds", () => {
    expect(hasUmlautWorkaround("persoenlichem Aufhaenger")).toBe(true);
    expect(hasUmlautWorkaround("Rueckfrage")).toBe(true);
  });

  it("meldet false fuer saubere Strings", () => {
    expect(hasUmlautWorkaround("Antwort an Frau Schmidt ausstehend")).toBe(false);
    expect(hasUmlautWorkaround("persönlicher Aufhänger")).toBe(false);
    expect(hasUmlautWorkaround("Email senden")).toBe(false);
  });
});

describe("UMLAUT_REPLACEMENTS Konsistenz", () => {
  it("jede Zielform enthaelt den eigenen Such-Stem nicht mehr (Idempotenz-Garantie)", () => {
    for (const [from, to] of UMLAUT_REPLACEMENTS) {
      expect(to.includes(from)).toBe(false);
    }
  });
});
