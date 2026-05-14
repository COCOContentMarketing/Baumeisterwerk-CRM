import { describe, it, expect } from "vitest";
import { hasMeeting, deriveSalutationDefault } from "../salutation";
import type { Interaction, InteractionType } from "@/types/db";

function mkInteraction(type: InteractionType): Interaction {
  return {
    id: "i",
    owner_id: null,
    company_id: "c",
    contact_id: "k",
    type,
    direction: "internal",
    subject: null,
    body: null,
    occurred_at: "2026-01-01T00:00:00Z",
    gmail_message_id: null,
    gmail_thread_id: null,
    gmail_draft_id: null,
    metadata: null,
    ai_classification: {},
    is_bounce: false,
    bounce_reason: null,
    created_at: "2026-01-01T00:00:00Z",
  };
}

describe("hasMeeting", () => {
  it("true, wenn ein Termin im Verlauf ist", () => {
    expect(
      hasMeeting([mkInteraction("email_sent"), mkInteraction("meeting")]),
    ).toBe(true);
  });

  it("false ohne Termin", () => {
    expect(
      hasMeeting([mkInteraction("email_sent"), mkInteraction("call")]),
    ).toBe(false);
  });

  it("false bei leerem Verlauf", () => {
    expect(hasMeeting([])).toBe(false);
  });
});

describe("deriveSalutationDefault", () => {
  it("'du' nach einem Termin", () => {
    expect(deriveSalutationDefault([mkInteraction("meeting")])).toBe("du");
  });

  it("'sie' ohne Termin", () => {
    expect(
      deriveSalutationDefault([
        mkInteraction("email_sent"),
        mkInteraction("email_received"),
      ]),
    ).toBe("sie");
  });

  it("'sie' bei leerem Verlauf", () => {
    expect(deriveSalutationDefault([])).toBe("sie");
  });
});
