import { describe, it, expect } from "vitest";
import { rollupLastInteraction } from "../companyRollup";

describe("rollupLastInteraction", () => {
  it("Parent + 2 Children mit unterschiedlichen Daten -> spaetestes Datum gewinnt", () => {
    const own = "2026-01-10T08:00:00Z";
    const children = ["2026-03-22T14:30:00Z", "2026-02-01T09:00:00Z"];
    expect(rollupLastInteraction(own, children)).toBe("2026-03-22T14:30:00Z");
  });

  it("Parent-Wert ist neuer als alle Children -> Parent gewinnt", () => {
    const own = "2026-05-01T00:00:00Z";
    const children = ["2026-03-22T14:30:00Z", "2026-02-01T09:00:00Z"];
    expect(rollupLastInteraction(own, children)).toBe("2026-05-01T00:00:00Z");
  });

  it("Parent ohne Children -> eigener Wert", () => {
    expect(rollupLastInteraction("2026-01-10T08:00:00Z", [])).toBe(
      "2026-01-10T08:00:00Z",
    );
  });

  it("Parent-Wert NULL, Children vorhanden -> spaetestes Child", () => {
    expect(
      rollupLastInteraction(null, ["2026-01-01T00:00:00Z", "2026-04-09T12:00:00Z"]),
    ).toBe("2026-04-09T12:00:00Z");
  });

  it("alle Werte NULL -> NULL", () => {
    expect(rollupLastInteraction(null, [null, null])).toBeNull();
    expect(rollupLastInteraction(null, [])).toBeNull();
  });

  it("ignoriert einzelne NULL-Children", () => {
    expect(
      rollupLastInteraction("2026-01-10T08:00:00Z", [null, "2026-06-15T10:00:00Z", null]),
    ).toBe("2026-06-15T10:00:00Z");
  });

  it("Parent-Wert gewinnt, wenn alle Children NULL sind", () => {
    expect(rollupLastInteraction("2026-01-10T08:00:00Z", [null, null])).toBe(
      "2026-01-10T08:00:00Z",
    );
  });
});
