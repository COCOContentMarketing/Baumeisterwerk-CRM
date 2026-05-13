// Klassifikations-Ergebnis fuer eine eingegangene Email. Wird von
// lib/claude/classifyReply.ts produziert und in interactions.ai_classification
// gespeichert. Die Cadence-Logik liest dann intent + ooo_until aus,
// um die passende Antwort-Empfehlung zu waehlen.

export type ReplyIntent = "interesse" | "rueckfrage" | "absage" | "ooo" | "unklar";
export type ReplySentiment = "positiv" | "neutral" | "negativ";
export type ReplyUrgency = "hoch" | "mittel" | "niedrig";

export interface ReplyClassification {
  intent: ReplyIntent;
  sentiment: ReplySentiment;
  urgency: ReplyUrgency;
  /** Konkret formulierter Vorschlag fuer den naechsten Schritt. */
  suggested_next_step: string;
  /** Bis zu 3 woertliche Zitate aus der Mail, die fuer den Intent ausschlaggebend sind. */
  key_quotes: string[];
  /** Wurde explizit ein Termin gewuenscht? */
  detected_meeting_request: boolean;
  /** Falls intent='ooo' und ein Rueckkehrdatum erkennbar ist (ISO-Date). */
  ooo_until?: string;
}

export function isReplyClassification(v: unknown): v is ReplyClassification {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.intent === "string" &&
    typeof o.sentiment === "string" &&
    typeof o.urgency === "string" &&
    typeof o.suggested_next_step === "string" &&
    Array.isArray(o.key_quotes) &&
    typeof o.detected_meeting_request === "boolean"
  );
}
