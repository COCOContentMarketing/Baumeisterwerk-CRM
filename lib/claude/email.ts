import { CLAUDE_MODEL, getClaude } from "./client";
import { BAUMEISTERWERK_BACKGROUND } from "./prompts";
import { findTemplate, findTemplateByName } from "@/lib/db/templates";
import type { Company, Contact, Interaction } from "@/types/db";
import { COMPANY_TYPE_LABELS } from "@/types/db";

export interface DraftedEmail {
  subject: string;
  body: string;
}

export interface CallBriefing {
  goal: string;
  talking_points: string[];
  questions: string[];
  objections: { objection: string; response: string }[];
}

function compactInteractions(interactions: Interaction[]): string {
  if (interactions.length === 0) return "Noch keine Kommunikation.";
  return interactions
    .slice(-10)
    .map((i) => {
      const head = `- [${i.occurred_at.slice(0, 10)} ${i.type}] ${i.subject ?? ""}`.trim();
      const body = i.body ? `\n  ${i.body.slice(0, 500)}` : "";
      return head + body;
    })
    .join("\n");
}

function contextBlock(args: {
  company: Company;
  contact: Contact | null;
  interactions: Interaction[];
  hint?: string;
}): string {
  const c = args.company;
  const p = args.contact;
  return [
    `Unternehmen: ${c.name} (${COMPANY_TYPE_LABELS[c.type]})`,
    c.city ? `Stadt: ${c.city}` : null,
    c.website ? `Website: ${c.website}` : null,
    `Status: ${c.status} · Prio: ${c.priority}`,
    c.notes ? `Notizen: ${c.notes}` : null,
    "",
    p
      ? `Ansprechpartner: ${p.full_name ?? "(unbenannt)"}${p.role ? ` · ${p.role}` : ""}` +
        (p.email ? ` · ${p.email}` : "") +
        ` · Sprache: ${p.language}`
      : "Kein spezifischer Ansprechpartner.",
    p?.notes ? `Person-Notizen: ${p.notes}` : null,
    "",
    "Bisherige Kommunikation:",
    compactInteractions(args.interactions),
    args.hint ? `\nZusaetzlicher Hinweis vom Nutzer:\n${args.hint}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

export async function draftEmail(args: {
  company: Company;
  contact: Contact;
  interactions: Interaction[];
  signature?: string | null;
  hint?: string;
  // Use-Case bestimmt, welche Template-Vorlage als Basis dient.
  // z.B. "erstkontakt", "follow_up_1", "inbound_reply", "post_meeting_thanks"
  useCase?: string;
  // Optional: explizit ein bestimmtes Template per Name waehlen.
  templateName?: string;
}): Promise<DraftedEmail> {
  const claude = getClaude();
  const language = args.contact.language;

  // Template aus DB laden: erst via Name, sonst via Use-Case + Company-Type.
  const template = args.templateName
    ? await findTemplateByName(args.templateName)
    : args.useCase
      ? await findTemplate({
          useCase: args.useCase,
          companyType: args.company.type,
          language,
        })
      : null;

  const templateBlock = template
    ? [
        "VORLAGE (Basis - bitte konkret personalisieren, nicht 1:1 uebernehmen):",
        `Betreff-Vorlage: ${template.subject_template ?? "(frei waehlen)"}`,
        "Body-Vorlage:",
        template.body_template,
        template.ai_guidance ? `\nWichtige Hinweise zur Anwendung:\n${template.ai_guidance}` : "",
      ].join("\n")
    : "Keine spezifische Vorlage hinterlegt - frei verfassen entlang der Tonalitaet im System-Prompt.";

  const userInstruction = `Verfasse eine Email an den Ansprechpartner.

Sprache: ${language === "de" ? "Deutsch" : "English"}

${templateBlock}

Antworte AUSSCHLIESSLICH als JSON-Objekt mit den Feldern "subject" (string) und "body" (string, mit \\n fuer Zeilenumbrueche). Keine Platzhalter wie {{anrede}} oder {{persoenlicher_hook}} stehen lassen - die musst du auf Basis der Kontextdaten konkret ausfuellen. Keine Markdown-Formatierung, kein Text drumherum.${
    args.signature ? `\n\nBeende den Body mit folgender Signatur:\n${args.signature}` : ""
  }`;

  const res = await claude.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 1500,
    system: [
      {
        type: "text",
        text: BAUMEISTERWERK_BACKGROUND,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: contextBlock(args) },
          { type: "text", text: userInstruction },
        ],
      },
    ],
  });

  const text = res.content
    .map((b) => (b.type === "text" ? b.text : ""))
    .join("")
    .trim();
  return parseJsonObject<DraftedEmail>(text, ["subject", "body"]);
}

export async function callBriefing(args: {
  company: Company;
  contact: Contact;
  interactions: Interaction[];
  hint?: string;
}): Promise<CallBriefing> {
  const claude = getClaude();
  const userInstruction = `Erstelle ein Telefonat-Briefing fuer ein Gespraech mit dem Ansprechpartner.
Antworte AUSSCHLIESSLICH als JSON-Objekt mit:
{
  "goal": string,
  "talking_points": string[3],
  "questions": string[3],
  "objections": [{ "objection": string, "response": string }]
}`;

  const res = await claude.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 1200,
    system: [
      {
        type: "text",
        text: BAUMEISTERWERK_BACKGROUND,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: contextBlock(args) },
          { type: "text", text: userInstruction },
        ],
      },
    ],
  });

  const text = res.content
    .map((b) => (b.type === "text" ? b.text : ""))
    .join("")
    .trim();
  return parseJsonObject<CallBriefing>(text, ["goal", "talking_points", "questions"]);
}

function parseJsonObject<T>(text: string, requiredKeys: string[]): T {
  const cleaned = text.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("Claude-Antwort ist kein JSON: " + text.slice(0, 200));
  const obj = JSON.parse(cleaned.slice(start, end + 1));
  for (const k of requiredKeys) {
    if (!(k in obj)) throw new Error(`Feld "${k}" fehlt in Claude-Antwort`);
  }
  return obj as T;
}
