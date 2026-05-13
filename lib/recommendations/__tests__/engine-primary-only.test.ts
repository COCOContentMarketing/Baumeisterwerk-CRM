import { describe, it, expect } from "vitest";
import { computePendingActionsFrom } from "../engine";
import type { Company, Contact, ContactCompanyLink, Interaction } from "@/types/db";

const ISO_NOW = "2026-05-13T10:00:00Z";
const NOW = new Date(ISO_NOW);

function company(id: string, overrides: Partial<Company> = {}): Company {
  return {
    id,
    owner_id: null,
    name: `Company ${id}`,
    type: "interior_designer",
    status: "lead",
    priority: "mittel",
    website: null,
    address: null,
    city: null,
    country: "DE",
    notes: null,
    tags: null,
    last_interaction_at: null,
    next_action_at: null,
    parent_company_id: null,
    is_group: false,
    location_label: null,
    created_at: ISO_NOW,
    updated_at: ISO_NOW,
    ...overrides,
  };
}

function contact(id: string, companyId: string, overrides: Partial<Contact> = {}): Contact {
  return {
    id,
    company_id: companyId,
    owner_id: null,
    first_name: `First${id}`,
    last_name: `Last${id}`,
    full_name: `First${id} Last${id}`,
    role: null,
    email: `${id}@example.com`,
    phone: null,
    language: "de",
    linkedin_url: null,
    notes: null,
    is_primary: false,
    last_interaction_at: null,
    email_invalid: false,
    email_invalid_since: null,
    email_invalid_reason: null,
    created_at: ISO_NOW,
    updated_at: ISO_NOW,
    ...overrides,
  };
}

function link(contactId: string, companyId: string, isPrimary: boolean): ContactCompanyLink {
  return {
    id: `L-${contactId}-${companyId}`,
    contact_id: contactId,
    company_id: companyId,
    is_primary: isPrimary,
    role: null,
    owner_id: null,
    created_at: ISO_NOW,
    updated_at: ISO_NOW,
  };
}

describe("computePendingActionsFrom - Primary-only Outbound-Empfehlung", () => {
  it("erzeugt fuer den Primary-Link eine Erstkontakt-Empfehlung", () => {
    const co = company("co1");
    const c1 = contact("c1", "co1");
    const actions = computePendingActionsFrom({
      companies: [co],
      contacts: [c1],
      interactions: [],
      links: [link("c1", "co1", true)],
      now: NOW,
    });
    expect(actions).toHaveLength(1);
    expect(actions[0].contact.id).toBe("c1");
    expect(actions[0].company.id).toBe("co1");
  });

  it("erzeugt KEINE Empfehlung fuer Nicht-Primary-Kontakte einer Company ohne Outbound", () => {
    const co = company("co1");
    const c1 = contact("c1", "co1");
    const c2 = contact("c2", "co1");
    const actions = computePendingActionsFrom({
      companies: [co],
      contacts: [c1, c2],
      interactions: [],
      links: [link("c1", "co1", true), link("c2", "co1", false)],
      now: NOW,
    });
    // Nur der Primary-Kontakt bekommt eine Erstkontakt-Empfehlung,
    // damit pro Company nicht mehrfach Erstkontakt-Recs entstehen.
    expect(actions).toHaveLength(1);
    expect(actions[0].contact.id).toBe("c1");
  });

  it("ein Kontakt der an zwei Standorten primary ist, bekommt pro Standort eine Empfehlung", () => {
    const co1 = company("co1", { name: "AR Tegernsee" });
    const co2 = company("co2", { name: "AR Muenchen" });
    const c1 = contact("c1", "co1");
    const actions = computePendingActionsFrom({
      companies: [co1, co2],
      contacts: [c1],
      interactions: [],
      links: [link("c1", "co1", true), link("c1", "co2", true)],
      now: NOW,
    });
    const companyIds = actions.map((a) => a.company.id).sort();
    expect(companyIds).toEqual(["co1", "co2"]);
  });

  it("ein Kontakt an Standort A ist primary, an Standort B nicht: nur A bekommt Erstkontakt", () => {
    const coA = company("coA");
    const coB = company("coB");
    const c1 = contact("c1", "coA");
    const actions = computePendingActionsFrom({
      companies: [coA, coB],
      contacts: [c1],
      interactions: [],
      links: [link("c1", "coA", true), link("c1", "coB", false)],
      now: NOW,
    });
    expect(actions).toHaveLength(1);
    expect(actions[0].company.id).toBe("coA");
  });

  it("Interaktionen werden pro (contact, company)-Paar gescoped: Touch an Standort A zaehlt nicht fuer Standort B", () => {
    const coA = company("coA");
    const coB = company("coB");
    const c1 = contact("c1", "coA");
    const longAgo = new Date(NOW.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
    // Outbound nur an coA: dort soll der Kontakt KEINE neue Erstkontakt-Reco
    // mehr ausloesen (Erstkontakt-Pfad verlangt "noch nicht angeschrieben").
    // An coB ist er primary und es gab keinen Touch -> dort Erstkontakt-Reco.
    const interactions: Interaction[] = [
      {
        id: "i1",
        owner_id: null,
        company_id: "coA",
        contact_id: "c1",
        type: "email_sent",
        direction: "outbound",
        subject: "Hi",
        body: null,
        occurred_at: longAgo,
        gmail_message_id: null,
        gmail_thread_id: null,
        gmail_draft_id: null,
        metadata: null,
        ai_classification: {},
        is_bounce: false,
        bounce_reason: null,
        created_at: longAgo,
      },
    ];
    const actions = computePendingActionsFrom({
      companies: [coA, coB],
      contacts: [c1],
      interactions,
      links: [link("c1", "coA", true), link("c1", "coB", true)],
      now: NOW,
    });
    const coBAction = actions.find((a) => a.company.id === "coB");
    expect(coBAction?.template_use_case).toBe("anschreiben_interior_designer_erstkontakt");
  });
});
