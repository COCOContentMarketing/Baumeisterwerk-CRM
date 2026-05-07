import { CLAUDE_MODEL, getClaude } from "./client";
import { BAUMEISTERWERK_BACKGROUND, RECOMMENDATIONS_INSTRUCTIONS } from "./prompts";
import type { Company, Contact, Priority, RecommendationKind } from "@/types/db";

export interface AiRecommendation {
  company_id: string;
  contact_id: string | null;
  kind: RecommendationKind;
  priority: Priority;
  title: string;
  reason: string;
  suggested_due_in_days: number;
}

export async function generateRecommendations(args: {
  companies: Company[];
  contacts: (Contact & { last_interaction_subject?: string | null })[];
}): Promise<AiRecommendation[]> {
  if (args.companies.length === 0) return [];
  const claude = getClaude();

  const companyTable = args.companies
    .map(
      (c) =>
        `- id=${c.id} | ${c.name} | ${c.type} | status=${c.status} | prio=${c.priority} | letzter_kontakt=${
          c.last_interaction_at?.slice(0, 10) ?? "nie"
        } | next_action=${c.next_action_at?.slice(0, 10) ?? "—"}`,
    )
    .join("\n");

  const contactTable = args.contacts
    .slice(0, 200)
    .map(
      (p) =>
        `- contact_id=${p.id} | company_id=${p.company_id} | ${p.full_name ?? "?"} | ${p.role ?? "?"} | letzter_kontakt=${
          p.last_interaction_at?.slice(0, 10) ?? "nie"
        }`,
    )
    .join("\n");

  const today = new Date().toISOString().slice(0, 10);

  const res = await claude.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 2000,
    system: [
      {
        type: "text",
        text: BAUMEISTERWERK_BACKGROUND,
        cache_control: { type: "ephemeral" },
      },
      { type: "text", text: RECOMMENDATIONS_INSTRUCTIONS },
    ],
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `Heute ist ${today}.\n\nUNTERNEHMEN:\n${companyTable}\n\nKONTAKTPERSONEN:\n${contactTable}`,
          },
        ],
      },
    ],
  });

  const text = res.content
    .map((b) => (b.type === "text" ? b.text : ""))
    .join("")
    .trim();

  return parseRecsArray(text);
}

function parseRecsArray(text: string): AiRecommendation[] {
  const cleaned = text.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  const start = cleaned.indexOf("[");
  const end = cleaned.lastIndexOf("]");
  if (start === -1 || end === -1) {
    throw new Error("Claude-Antwort ist kein JSON-Array: " + text.slice(0, 200));
  }
  const arr = JSON.parse(cleaned.slice(start, end + 1));
  if (!Array.isArray(arr)) throw new Error("Erwarte ein Array");
  return arr as AiRecommendation[];
}
