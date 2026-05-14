import { describe, it, expect } from "vitest";
import { buildSalutationInstruction } from "../email";

describe("buildSalutationInstruction", () => {
  it("liefert eine Du-Anweisung fuer deutschsprachige Kontakte", () => {
    const s = buildSalutationInstruction("du", "de");
    expect(s).not.toBe("");
    expect(s).toMatch(/Duze/);
  });

  it("liefert eine Sie-Anweisung fuer deutschsprachige Kontakte", () => {
    const s = buildSalutationInstruction("sie", "de");
    expect(s).not.toBe("");
    expect(s).toMatch(/Sieze/);
  });

  it("liefert einen leeren String fuer englischsprachige Kontakte", () => {
    expect(buildSalutationInstruction("du", "en")).toBe("");
    expect(buildSalutationInstruction("sie", "en")).toBe("");
  });
});
