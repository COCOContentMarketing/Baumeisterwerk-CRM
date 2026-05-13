import { describe, it, expect } from "vitest";
import {
  migrateExistingPrimaries,
  pickPrimaryAfterUpdate,
  type PrimaryAssignmentLink,
  type MigrationInputContact,
} from "../primaryAssignment";

function link(id: string, contactId: string, companyId: string, isPrimary: boolean): PrimaryAssignmentLink {
  return { id, contact_id: contactId, company_id: companyId, is_primary: isPrimary };
}

describe("pickPrimaryAfterUpdate (Trigger-Semantik)", () => {
  it("setzen eines neuen Primary demoted alten Primary derselben Company", () => {
    const links = [
      link("L1", "C1", "CO1", true),
      link("L2", "C2", "CO1", false),
      link("L3", "C3", "CO2", true),
    ];
    const after = pickPrimaryAfterUpdate(links, link("L2", "C2", "CO1", true));

    const l1 = after.find((l) => l.id === "L1")!;
    const l2 = after.find((l) => l.id === "L2")!;
    const l3 = after.find((l) => l.id === "L3")!;
    expect(l2.is_primary).toBe(true);
    expect(l1.is_primary).toBe(false);
    // Andere Company bleibt unangetastet
    expect(l3.is_primary).toBe(true);
  });

  it("setzen eines Links auf is_primary=false demoted niemanden", () => {
    const links = [link("L1", "C1", "CO1", true), link("L2", "C2", "CO1", false)];
    const after = pickPrimaryAfterUpdate(links, link("L1", "C1", "CO1", false));
    expect(after.find((l) => l.id === "L1")!.is_primary).toBe(false);
    expect(after.find((l) => l.id === "L2")!.is_primary).toBe(false);
  });

  it("Insert eines neuen Primary-Links fuegt Eintrag hinzu und demoted bisherigen", () => {
    const links = [link("L1", "C1", "CO1", true)];
    const after = pickPrimaryAfterUpdate(links, link("L2", "C2", "CO1", true));
    expect(after).toHaveLength(2);
    expect(after.find((l) => l.id === "L1")!.is_primary).toBe(false);
    expect(after.find((l) => l.id === "L2")!.is_primary).toBe(true);
  });

  it("Single-Primary-Constraint: nach jedem Update gibt es pro Company hoechstens einen Primary", () => {
    let links: PrimaryAssignmentLink[] = [
      link("L1", "C1", "CO1", false),
      link("L2", "C2", "CO1", false),
      link("L3", "C3", "CO1", false),
    ];
    // Setze nacheinander C1, C2, C3 jeweils als Primary
    links = pickPrimaryAfterUpdate(links, link("L1", "C1", "CO1", true));
    links = pickPrimaryAfterUpdate(links, link("L2", "C2", "CO1", true));
    links = pickPrimaryAfterUpdate(links, link("L3", "C3", "CO1", true));

    const primaries = links.filter((l) => l.company_id === "CO1" && l.is_primary);
    expect(primaries).toHaveLength(1);
    expect(primaries[0].id).toBe("L3");
  });
});

describe("migrateExistingPrimaries (Datenmigration aus 0008)", () => {
  it("spiegelt alle Kontakte als Links, default is_primary=false", () => {
    const contacts: MigrationInputContact[] = [
      { id: "c1", company_id: "co1", is_primary: false, created_at: "2024-01-01" },
      { id: "c2", company_id: "co1", is_primary: false, created_at: "2024-02-01" },
    ];
    const links = migrateExistingPrimaries(contacts);
    expect(links).toHaveLength(2);
    expect(links.every((l) => !l.is_primary)).toBe(true);
  });

  it("bei mehreren Primaries pro Company bleibt nur der aelteste primary", () => {
    const contacts: MigrationInputContact[] = [
      { id: "c1", company_id: "co1", is_primary: true, created_at: "2024-03-01" },
      { id: "c2", company_id: "co1", is_primary: true, created_at: "2024-01-15" }, // aeltester
      { id: "c3", company_id: "co1", is_primary: true, created_at: "2024-02-01" },
      { id: "c4", company_id: "co2", is_primary: true, created_at: "2024-01-01" },
    ];
    const links = migrateExistingPrimaries(contacts);
    const co1 = links.filter((l) => l.company_id === "co1");
    const primaryCo1 = co1.filter((l) => l.is_primary);
    expect(primaryCo1).toHaveLength(1);
    expect(primaryCo1[0].contact_id).toBe("c2");
    // andere co1-Kontakte sind nicht primary
    expect(co1.filter((l) => l.contact_id !== "c2").every((l) => !l.is_primary)).toBe(true);
    // co2 hat seinen einen Primary
    expect(links.find((l) => l.contact_id === "c4")!.is_primary).toBe(true);
  });

  it("Company ohne Primary-Kontakt bekommt keinen Link-Primary", () => {
    const contacts: MigrationInputContact[] = [
      { id: "c1", company_id: "co1", is_primary: false, created_at: "2024-01-01" },
      { id: "c2", company_id: "co1", is_primary: false, created_at: "2024-02-01" },
    ];
    const links = migrateExistingPrimaries(contacts);
    expect(links.every((l) => !l.is_primary)).toBe(true);
  });
});
