import { describe, expect, it } from "vitest";
import { emptyDoc, mergeDocs, Template } from "../src/core/model";
import { buildSalutation, parseName } from "../src/core/names";
import { analyze, fill, FillContext } from "../src/core/placeholders";

describe("parseName", () => {
  it.each([
    ["Erika Müller", "", "", "Erika", "Müller"],
    ["Müller, Erika", "", "", "Erika", "Müller"],
    ["Dr. Hans-Peter Schmidt", "", "Dr.", "Hans-Peter", "Schmidt"],
    ["Prof. Dr. Anna von der Heide", "", "Prof. Dr.", "Anna", "von der Heide"],
    ["Meier, Karl (Firma GmbH)", "", "", "Karl", "Meier"],
    ["", "anna.schulz@example.com", "", "Anna", "Schulz"],
    ["info@example.com", "info@example.com", "", "", ""],
    ["Schmidt", "", "", "", "Schmidt"],
  ])("%s / %s", (display, email, titel, vorname, nachname) => {
    expect(parseName(display, email)).toEqual({ titel, vorname, nachname });
  });
});

describe("buildSalutation", () => {
  const n = { titel: "Dr.", vorname: "Erika", nachname: "Müller" };
  it("bildet die Anredeformen", () => {
    expect(buildSalutation("frau", n)).toBe("Sehr geehrte Frau Dr. Müller");
    expect(buildSalutation("herr", { ...n, titel: "" })).toBe("Sehr geehrter Herr Müller");
    expect(buildSalutation("gutenTag", { ...n, titel: "" })).toBe("Guten Tag Erika Müller");
    expect(buildSalutation("hallo", n)).toBe("Hallo Erika");
    expect(buildSalutation("frau", { titel: "", vorname: "", nachname: "" })).toBe("Sehr geehrte Damen und Herren");
  });
});

const ctx: FillContext = {
  now: new Date(2026, 10, 12, 9, 5),
  salutation: "Sehr geehrte Frau Müller",
  recipient: { name: "Erika Müller", vorname: "Erika", nachname: "Müller", titel: "", email: "e@example.com" },
  sender: { name: "Max Beispiel", email: "m@example.com" },
  subject: "Anfrage",
};

describe("Platzhalter", () => {
  it("füllt eingebaute Platzhalter", () => {
    expect(fill("{{Anrede}}, heute ist {{Wochentag}}, der {{Datum}}.", ctx, {}, false)).toBe(
      "Sehr geehrte Frau Müller, heute ist Donnerstag, der 12.11.2026.",
    );
    expect(fill("{{Empfänger.Vorname}} {{Empfaenger.Nachname}} / {{ absender.name }}", ctx, {}, false)).toBe(
      "Erika Müller / Max Beispiel",
    );
    expect(fill("{{Uhrzeit}} {{Datum.Lang}}", ctx, {}, false)).toBe("09:05 12. November 2026");
  });

  it("rechnet mit Datumsangaben über Monats- und Jahresgrenzen", () => {
    expect(fill("{{Datum+14}}", ctx, {}, false)).toBe("26.11.2026");
    expect(fill("{{Datum+60}}", ctx, {}, false)).toBe("11.01.2027");
    expect(fill("{{Datum-12}}", ctx, {}, false)).toBe("31.10.2026");
  });

  it("erkennt abzufragende Felder und Auswahllisten", () => {
    const a = analyze("Az. {{Aktenzeichen}}", "<p>{{Anrede}}, {{Ort|Büro|Video}} {{Aktenzeichen}} {{Datum}}</p>");
    expect(a.usesRecipient).toBe(true);
    expect(a.fields).toEqual([
      { key: "aktenzeichen", label: "Aktenzeichen", options: [] },
      { key: "ort", label: "Ort", options: ["Büro", "Video"] },
    ]);
    expect(analyze("<p>{{Datum}}</p>").usesRecipient).toBe(false);
  });

  it("maskiert Feldwerte in HTML und lässt leere Felder stehen", () => {
    expect(fill("<p>{{Notiz}}</p>", ctx, { notiz: "<b>a & b</b>" }, true)).toBe("<p>&lt;b&gt;a &amp; b&lt;/b&gt;</p>");
    expect(fill("<p>{{Notiz}}</p>", ctx, {}, true)).toBe("<p>{{Notiz}}</p>");
    expect(fill("{{Ort|A|B}}", ctx, { ort: "B" }, false)).toBe("B");
  });
});

describe("mergeDocs", () => {
  const t = (id: string, name: string, modified: string, deleted = false): Template => ({
    id, name, category: "", subject: "", html: "x", modified, deleted,
  });
  const now = new Date("2026-11-12T00:00:00Z");

  it("übernimmt je Vorlage den jüngeren Stand und behält Löschungen", () => {
    const a = { ...emptyDoc(), templates: [t("1", "alt", "2026-11-01"), t("2", "nur A", "2026-11-01")] };
    const b = { ...emptyDoc(), templates: [t("1", "neu", "2026-11-02"), t("2", "", "2026-11-05", true), t("3", "nur B", "2026-11-01")] };
    const m = mergeDocs(a, b, now);
    expect(m.templates.find((x) => x.id === "1")?.name).toBe("neu");
    expect(m.templates.find((x) => x.id === "2")?.deleted).toBe(true);
    expect(m.templates).toHaveLength(3);
  });

  it("entfernt alte Löschmarken", () => {
    const a = { ...emptyDoc(), templates: [t("1", "", "2026-01-01", true)] };
    expect(mergeDocs(a, emptyDoc(), now).templates).toHaveLength(0);
  });
});
