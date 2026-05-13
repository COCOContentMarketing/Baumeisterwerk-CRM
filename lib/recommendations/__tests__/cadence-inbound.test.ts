import { describe, it, expect } from "vitest";
import { evaluateContact } from "../cadence";
import type { Company, Contact, Interaction } from "@/types/db";
import type { ReplyClassification, ReplyIntent } from "@/types/classification";

const NOW = new Date("2026-05-13T10:00:00Z");
const INBOUND_AT = new Date("2026-05-13T08:00:00Z").toISOString();

function makeCompany(overrides: Partial<Company> = {}): Company {
  return {
    id: "co-1",
    owner_id: null,
    name: "AR Interior",
    type: "interior_designer",
    status: "kontaktiert",
    priority: "mittel",
    website: null,
    address: null,
    city: null,
    country: "DE",
    notes: null,
    tags: null,
    last_interaction_at: INBOUND_AT,
    next_action_at: null,
    parent_company_id: null,
    is_group: false,
    location_label: null,
    created_at: INBOUND_AT,
    updated_at: INBOUND_AT,
    ...overrides,
  };
}

function makeContact(overrides: Partial<Contact> = {}): Contact {
  return {
    id: "co-1-c1",
    company_id: "co-1",
    owner_id: null,
    first_name: "Alexandra",
    last_name: "Rasp",
    full_name: "Alexandra Rasp",
    role: null,
    email: "alexandra@example.com",
    phone: null,
    language: "de",
    linkedin_url: null,
    notes: null,
    is_primary: true,
    last_interaction_at: INBOUND_AT,
    email_invalid: false,
    email_invalid_since: null,
    email_invalid_reason: null,
    created_at: INBOUND_AT,
    updated_at: INBOUND_AT,
    ...overrides,
  } satisfies Contact;
}

function makeInbound(classification: ReplyClassification | null, overrides: Partial<Interaction> = {}): Interaction {
  return {
    id: "i-1",
    owner_id: null,
    company_id: "co-1",
    contact_id: "co-1-c1",
    type: "email_received",
    direction: "inbound",
    subject: "Re: Kooperation",
    body: "Inhalt der Mail.",
    occurred_at: INBOUND_AT,
    gmail_message_id: "msg-1",
    gmail_thread_id: "th-1",
    gmail_draft_id: null,
    metadata: null,
    ai_classification: (classification ?? {}) as Record<string, unknown>,
    is_bounce: false,
    bounce_reason: null,
    created_at: INBOUND_AT,
    ...overrides,
  };
}

function cls(intent: ReplyIntent, overrides: Partial<ReplyClassification> = {}): ReplyClassification {
  return {
    intent,
    sentiment: "neutral",
    urgency: "mittel",
    suggested_next_step: "Termin anbieten",
    key_quotes: ["Schlüsselzitat"],
    detected_meeting_request: false,
    ...overrides,
  };
}

describe("evaluateContact - Inbound-Pfad", () => {
  it("ohne Klassifikation: nach Karenz -> generisches inbound_reply", () => {
    const fiveHoursAgo = new Date(NOW.getTime() - 5 * 60 * 60 * 1000).toISOString();
    const action = evaluateContact({
      company: makeCompany(),
      contact: makeContact(),
      interactions: [makeInbound(null, { occurred_at: fiveHoursAgo })],
      now: NOW,
    });
    expect(action?.template_use_case).toBe("inbound_reply");
    expect(action?.priority).toBe("hoch");
  });

  it("ohne Klassifikation: innerhalb 4h -> kein Vorschlag", () => {
    const tooFresh = new Date(NOW.getTime() - 60 * 60 * 1000).toISOString();
    const action = evaluateContact({
      company: makeCompany(),
      contact: makeContact(),
      interactions: [makeInbound(null, { occurred_at: tooFresh })],
      now: NOW,
    });
    expect(action).toBeNull();
  });

  it("intent=interesse -> inbound_reply_interest, hoch", () => {
    const action = evaluateContact({
      company: makeCompany(),
      contact: makeContact(),
      interactions: [makeInbound(cls("interesse"))],
      now: NOW,
    });
    expect(action?.template_use_case).toBe("inbound_reply_interest");
    expect(action?.priority).toBe("hoch");
    expect(action?.inbound_reply_context?.classification.intent).toBe("interesse");
  });

  it("intent=rueckfrage -> inbound_reply_rueckfrage, hoch", () => {
    const action = evaluateContact({
      company: makeCompany(),
      contact: makeContact(),
      interactions: [makeInbound(cls("rueckfrage"))],
      now: NOW,
    });
    expect(action?.template_use_case).toBe("inbound_reply_rueckfrage");
    expect(action?.priority).toBe("hoch");
  });

  it("intent=absage -> reaktivierungs-Template, niedrig, due in 90 Tagen", () => {
    const action = evaluateContact({
      company: makeCompany(),
      contact: makeContact(),
      interactions: [makeInbound(cls("absage"))],
      now: NOW,
    });
    expect(action?.template_use_case).toBe("inbound_reply_absage_reaktivierung");
    expect(action?.priority).toBe("niedrig");
    const dueMs = new Date(action!.due_at).getTime();
    const expectedMs = NOW.getTime() + 90 * 24 * 60 * 60 * 1000;
    expect(Math.abs(dueMs - expectedMs)).toBeLessThan(1000);
  });

  it("intent=ooo + ooo_until -> Reminder mit due_at=ooo_until, mittel", () => {
    const oooDate = "2026-06-01";
    const action = evaluateContact({
      company: makeCompany(),
      contact: makeContact(),
      interactions: [makeInbound(cls("ooo", { ooo_until: oooDate }))],
      now: NOW,
    });
    expect(action?.template_use_case).toBe("inbound_reply_ooo");
    expect(action?.priority).toBe("mittel");
    expect(action?.due_at.slice(0, 10)).toBe(oooDate);
  });

  it("intent=ooo ohne ooo_until -> Default +7 Tage", () => {
    const action = evaluateContact({
      company: makeCompany(),
      contact: makeContact(),
      interactions: [makeInbound(cls("ooo"))],
      now: NOW,
    });
    expect(action?.due_at).toBeDefined();
    const dueMs = new Date(action!.due_at).getTime();
    const expectedMs = NOW.getTime() + 7 * 24 * 60 * 60 * 1000;
    expect(Math.abs(dueMs - expectedMs)).toBeLessThan(1000);
  });

  it("intent=unklar -> inbound_reply_unklar, mittel", () => {
    const action = evaluateContact({
      company: makeCompany(),
      contact: makeContact(),
      interactions: [makeInbound(cls("unklar"))],
      now: NOW,
    });
    expect(action?.template_use_case).toBe("inbound_reply_unklar");
    expect(action?.priority).toBe("mittel");
  });

  it("Bounce-Inbound -> kein Reply-Vorschlag", () => {
    const action = evaluateContact({
      company: makeCompany(),
      contact: makeContact(),
      interactions: [
        makeInbound(null, {
          is_bounce: true,
          bounce_reason: "Mailbox full",
          body: null,
        }),
      ],
      now: NOW,
    });
    expect(action).toBeNull();
  });

  it("Outbound nach Inbound -> Inbound-Pfad nicht aktiv", () => {
    const company = makeCompany();
    const contact = makeContact();
    const outbound: Interaction = {
      ...makeInbound(null),
      id: "i-out",
      direction: "outbound",
      type: "email_sent",
      occurred_at: new Date(NOW.getTime() - 30 * 60 * 1000).toISOString(),
    };
    const action = evaluateContact({
      company,
      contact,
      interactions: [makeInbound(cls("interesse")), outbound],
      now: NOW,
    });
    // Inbound bereits beantwortet (Outbound danach), darum kein Reply-Reco.
    expect(action?.template_use_case).not.toBe("inbound_reply_interest");
  });
});
