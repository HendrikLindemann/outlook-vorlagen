/**
 * Platzhalter-Engine.
 *
 * Syntax im Vorlagentext:
 *   {{Anrede}}                 automatisch gefüllter Platzhalter
 *   {{Datum+14}}               berechnet (heute plus 14 Tage)
 *   {{Aktenzeichen}}           freies Feld, wird beim Einfügen abgefragt
 *   {{Zahlungsart|Überweisung|Lastschrift}}   Auswahlliste
 */

export interface FillContext {
  now: Date;
  salutation: string;
  recipient: { name: string; vorname: string; nachname: string; titel: string; email: string };
  sender: { name: string; email: string };
  subject: string;
}

export interface CustomField {
  key: string;
  label: string;
  options: string[]; // leer = Freitext
}

export interface Analysis {
  usesRecipient: boolean; // Anrede oder Empfänger.* kommt vor
  fields: CustomField[]; // abzufragende Felder in Reihenfolge des Auftretens
}

const TOKEN = /\{\{([^{}<>]{1,200})\}\}/g;

/** Vereinheitlicht Namen: Kleinbuchstaben, Umlaute umschrieben, ohne Leerzeichen. */
export function normalizeKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/\s+/g, "");
}

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/\n/g, "<br>");
}

function parseToken(inner: string): { label: string; key: string; options: string[] } {
  const [label, ...options] = decodeEntities(inner)
    .split("|")
    .map((p) => p.trim());
  return { label, key: normalizeKey(label), options: options.filter(Boolean) };
}

const pad = (n: number) => String(n).padStart(2, "0");
const MONTHS = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];
const WEEKDAYS = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];

const shortDate = (d: Date) => `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
const longDate = (d: Date) => `${d.getDate()}. ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;

function addDays(d: Date, days: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + days);
  return r;
}

/** Liefert den Wert eines eingebauten Platzhalters oder undefined, wenn der Name kein eingebauter ist. */
export function resolveBuiltin(key: string, ctx: FillContext): string | undefined {
  const date = /^datum(\.lang)?(?:([+-])(\d{1,4}))?$/.exec(key);
  if (date) {
    const d = addDays(ctx.now, date[2] ? (date[2] === "-" ? -1 : 1) * Number(date[3]) : 0);
    return date[1] ? longDate(d) : shortDate(d);
  }
  switch (key) {
    case "anrede":
      return ctx.salutation;
    case "empfaenger":
    case "empfaenger.name":
      return ctx.recipient.name;
    case "empfaenger.vorname":
      return ctx.recipient.vorname;
    case "empfaenger.nachname":
      return ctx.recipient.nachname;
    case "empfaenger.titel":
      return ctx.recipient.titel;
    case "empfaenger.email":
      return ctx.recipient.email;
    case "absender":
    case "absender.name":
      return ctx.sender.name;
    case "absender.email":
      return ctx.sender.email;
    case "betreff":
      return ctx.subject;
    case "uhrzeit":
      return `${pad(ctx.now.getHours())}:${pad(ctx.now.getMinutes())}`;
    case "wochentag":
      return WEEKDAYS[ctx.now.getDay()];
    case "monat":
      return MONTHS[ctx.now.getMonth()];
    case "jahr":
      return String(ctx.now.getFullYear());
    default:
      return undefined;
  }
}

const EMPTY_CTX: FillContext = {
  now: new Date(0),
  salutation: "",
  recipient: { name: "", vorname: "", nachname: "", titel: "", email: "" },
  sender: { name: "", email: "" },
  subject: "",
};

/** Ermittelt, welche Angaben eine Vorlage beim Einfügen benötigt. */
export function analyze(...texts: string[]): Analysis {
  const fields = new Map<string, CustomField>();
  let usesRecipient = false;
  for (const text of texts) {
    for (const m of text.matchAll(TOKEN)) {
      const t = parseToken(m[1]);
      if (!t.key) continue;
      if (t.key === "anrede" || t.key.startsWith("empfaenger")) usesRecipient = true;
      if (t.options.length === 0 && resolveBuiltin(t.key, EMPTY_CTX) !== undefined) continue;
      const existing = fields.get(t.key);
      if (!existing) fields.set(t.key, { key: t.key, label: t.label, options: t.options });
      else if (existing.options.length === 0) existing.options = t.options;
    }
  }
  return { usesRecipient, fields: [...fields.values()] };
}

/**
 * Ersetzt alle Platzhalter. Eigene Feldwerte haben Vorrang vor eingebauten.
 * Unbekannte oder leere Felder bleiben als {{Name}} sichtbar stehen.
 */
export function fill(text: string, ctx: FillContext, values: Record<string, string>, asHtml: boolean): string {
  return text.replace(TOKEN, (whole, inner: string) => {
    const t = parseToken(inner);
    let value: string | undefined = values[t.key];
    if (value === undefined || value === "") {
      value = t.options.length ? undefined : resolveBuiltin(t.key, ctx);
    }
    if (value === undefined || value === "") return whole;
    return asHtml ? escapeHtml(value) : value;
  });
}

/** Liste der eingebauten Platzhalter für das Einfügemenü im Editor. */
export const BUILTIN_PLACEHOLDERS: { token: string; hint: string }[] = [
  { token: "{{Anrede}}", hint: "Briefanrede, z. B. Sehr geehrte Frau Müller" },
  { token: "{{Empfänger.Name}}", hint: "Vor- und Nachname" },
  { token: "{{Empfänger.Vorname}}", hint: "" },
  { token: "{{Empfänger.Nachname}}", hint: "" },
  { token: "{{Absender.Name}}", hint: "Ihr Anzeigename" },
  { token: "{{Datum}}", hint: "heute, TT.MM.JJJJ" },
  { token: "{{Datum+14}}", hint: "heute plus 14 Tage" },
  { token: "{{Datum.Lang}}", hint: "z. B. 12. November 2026" },
  { token: "{{Wochentag}}", hint: "" },
  { token: "{{Uhrzeit}}", hint: "" },
  { token: "{{Betreff}}", hint: "Betreff der E-Mail" },
  { token: "{{Feldname}}", hint: "freies Feld, wird abgefragt" },
  { token: "{{Feldname|Option A|Option B}}", hint: "Auswahlliste" },
];
