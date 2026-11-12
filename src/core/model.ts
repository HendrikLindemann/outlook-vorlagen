import type { SalutationForm } from "./names";

export interface Template {
  id: string;
  name: string;
  category: string;
  subject: string;
  html: string;
  modified: string; // ISO-Zeitstempel
  deleted?: boolean; // Löschmarke, damit Löschungen den Abgleich überleben
}

export interface SalutationMemo {
  form: SalutationForm;
  titel: string;
  vorname: string;
  nachname: string;
  modified: string;
}

export interface DataDoc {
  version: 1;
  templates: Template[];
  salutations: Record<string, SalutationMemo>; // Schlüssel: E-Mail-Adresse in Kleinbuchstaben
}

export const emptyDoc = (): DataDoc => ({ version: 1, templates: [], salutations: {} });

export function normalizeDoc(raw: unknown): DataDoc {
  const d = (raw ?? {}) as Partial<DataDoc>;
  return {
    version: 1,
    templates: Array.isArray(d.templates) ? d.templates.filter((t) => t && t.id) : [],
    salutations: d.salutations && typeof d.salutations === "object" ? d.salutations : {},
  };
}

const TOMBSTONE_DAYS = 90;

/** Führt zwei Stände zusammen. Je Eintrag gewinnt die jüngere Änderung. */
export function mergeDocs(a: DataDoc, b: DataDoc, now = new Date()): DataDoc {
  const byId = new Map<string, Template>();
  for (const t of [...a.templates, ...b.templates]) {
    const other = byId.get(t.id);
    if (!other || t.modified > other.modified) byId.set(t.id, t);
  }
  const cutoff = new Date(now.getTime() - TOMBSTONE_DAYS * 86400000).toISOString();
  const templates = [...byId.values()].filter((t) => !(t.deleted && t.modified < cutoff));

  const salutations: Record<string, SalutationMemo> = { ...a.salutations };
  for (const [email, memo] of Object.entries(b.salutations)) {
    const other = salutations[email];
    if (!other || memo.modified > other.modified) salutations[email] = memo;
  }
  return { version: 1, templates, salutations };
}

export function visibleTemplates(doc: DataDoc): Template[] {
  return doc.templates
    .filter((t) => !t.deleted)
    .sort((x, y) => x.category.localeCompare(y.category, "de") || x.name.localeCompare(y.name, "de"));
}

export function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
