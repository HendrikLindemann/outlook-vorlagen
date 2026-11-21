import { describe, expect, it } from "vitest";
import type { Template } from "../src/core/model";
import { buildExport, exportFileName, parseImport, planImport, toBase64, toTemplates } from "../src/core/transfer";

const tpl = (name: string, html = "<p>x</p>", category = "", extra: Partial<Template> = {}): Template => ({
  id: name, name, category, subject: "", html, modified: "2026-11-01T00:00:00Z", ...extra,
});

describe("Export", () => {
  it("enthält nur Vorlagen, ohne IDs und Löschmarken", () => {
    const file = buildExport([tpl("A"), tpl("B", "", "", { deleted: true })], new Date("2026-11-21T10:00:00Z"));
    expect(file.format).toBe("outlook-textvorlagen");
    expect(file.templates).toEqual([{ name: "A", category: "", subject: "", html: "<p>x</p>" }]);
    expect(JSON.stringify(file)).not.toContain("salutations");
  });
  it("benennt die Datei nach dem Datum", () => {
    expect(exportFileName(new Date(2026, 10, 3))).toBe("textvorlagen-2026-11-03.json");
  });
  it("kodiert Umlaute korrekt als Base64", () => {
    expect(new TextDecoder().decode(Uint8Array.from(atob(toBase64("Grüße €")), (c) => c.charCodeAt(0)))).toBe("Grüße €");
  });
});

describe("parseImport", () => {
  it("liest das Exportformat", () => {
    const text = JSON.stringify(buildExport([tpl("A")]));
    expect(parseImport(text)).toEqual([{ name: "A", category: "", subject: "", html: "<p>x</p>" }]);
  });
  it("liest auch vorlagen.json, ohne Anreden und gelöschte Vorlagen", () => {
    const doc = { version: 1, templates: [tpl("A"), tpl("B", "<p>y</p>", "", { deleted: true })], salutations: { "a@b.de": {} } };
    expect(parseImport(JSON.stringify(doc)).map((t) => t.name)).toEqual(["A"]);
  });
  it("lehnt ungültige Dateien verständlich ab", () => {
    expect(() => parseImport("kein json")).toThrow(/kein JSON/);
    expect(() => parseImport("{}")).toThrow(/keine Textvorlagen/);
    expect(() => parseImport(JSON.stringify({ format: "outlook-textvorlagen", templates: [{ name: "", html: "" }] }))).toThrow(
      /keine Textvorlagen/,
    );
  });
});

describe("planImport", () => {
  const existing = [tpl("Gruß"), tpl("Termin", "<p>alt</p>", "Termine"), tpl("Termin (Import)", "<p>z</p>", "Termine")];

  it("überspringt Gleiches, legt Geändertes als Kopie an und Neues normal", () => {
    const items = planImport(existing, [
      { name: "Gruß", category: "", subject: "", html: "<p>x</p>" },
      { name: "termin", category: "termine", subject: "", html: "<p>neu</p>" },
      { name: "Absage", category: "", subject: "", html: "<p>a</p>" },
      { name: "Absage", category: "", subject: "", html: "<p>a</p>" },
    ]);
    expect(items.map((i) => [i.status, i.targetName])).toEqual([
      ["vorhanden", "Gruß"],
      ["geaendert", "termin (Import 2)"],
      ["neu", "Absage"],
    ]);
  });

  it("ignoriert gelöschte Vorlagen im Bestand", () => {
    const items = planImport([tpl("A", "<p>x</p>", "", { deleted: true })], [{ name: "A", category: "", subject: "", html: "<p>y</p>" }]);
    expect(items[0]).toMatchObject({ status: "neu", targetName: "A" });
  });

  it("erzeugt neue Vorlagen mit eigener ID und bereinigtem HTML", () => {
    const items = planImport([], [{ name: "A", category: "K", subject: "S", html: "<p>x</p><script>1</script>" }]);
    const [t] = toTemplates(items, (h) => h.replace(/<script>.*<\/script>/, ""), new Date("2026-11-21T00:00:00Z"));
    expect(t).toMatchObject({ name: "A", category: "K", subject: "S", html: "<p>x</p>", modified: "2026-11-21T00:00:00.000Z" });
    expect(t.id).toBeTruthy();
  });
});
