import { newId, Template, visibleTemplates, normalizeDoc } from "./model";

/** Austauschformat für Export und Import. Enthält nur Vorlagen, keine persönlichen Daten wie das Anrede-Gedächtnis. */
export const EXPORT_FORMAT = "outlook-textvorlagen";

export interface ExportedTemplate {
  name: string;
  category: string;
  subject: string;
  html: string;
}

export interface ExportFile {
  format: typeof EXPORT_FORMAT;
  version: 1;
  exported: string;
  templates: ExportedTemplate[];
}

export const MAX_IMPORT_BYTES = 2_000_000;

export function buildExport(templates: Template[], now = new Date()): ExportFile {
  return {
    format: EXPORT_FORMAT,
    version: 1,
    exported: now.toISOString(),
    templates: templates
      .filter((t) => !t.deleted)
      .map(({ name, category, subject, html }) => ({ name, category, subject, html })),
  };
}

export function exportFileName(now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `textvorlagen-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}.json`;
}

const str = (v: unknown) => (typeof v === "string" ? v : "");

/**
 * Liest eine Exportdatei. Akzeptiert auch die Speicherdatei vorlagen.json des Add-ins;
 * deren Anrede-Gedächtnis wird dabei bewusst ignoriert.
 */
export function parseImport(text: string): ExportedTemplate[] {
  if (text.length > MAX_IMPORT_BYTES) throw new Error("Die Datei ist zu groß (maximal 2 MB).");
  let raw: unknown;
  try {
    raw = JSON.parse(text.replace(/^﻿/, ""));
  } catch {
    throw new Error("Die Datei ist keine gültige Vorlagen-Datei (kein JSON).");
  }
  const obj = (raw ?? {}) as Record<string, unknown>;
  let list: unknown[];
  if (obj.format === EXPORT_FORMAT && Array.isArray(obj.templates)) {
    list = obj.templates;
  } else if (Array.isArray(obj.templates) && "salutations" in obj) {
    list = visibleTemplates(normalizeDoc(obj));
  } else {
    throw new Error("Die Datei enthält keine Textvorlagen.");
  }
  const result = list
    .map((t) => (t ?? {}) as Record<string, unknown>)
    .map((t) => ({ name: str(t.name).trim(), category: str(t.category).trim(), subject: str(t.subject), html: str(t.html) }))
    .filter((t) => t.name && t.html.trim());
  if (result.length === 0) throw new Error("Die Datei enthält keine Textvorlagen.");
  return result;
}

export type ImportStatus = "neu" | "vorhanden" | "geaendert";

export interface ImportItem {
  template: ExportedTemplate;
  status: ImportStatus;
  /** Name, unter dem die Vorlage angelegt wird (bei Namensgleichheit mit Zusatz). */
  targetName: string;
}

const key = (name: string, category: string) => `${category.toLowerCase()}\u0000${name.toLowerCase()}`;

/**
 * Vergleicht die Importdatei mit dem Bestand:
 * - gleicher Name, gleiche Kategorie, gleicher Inhalt: "vorhanden", wird übersprungen
 * - gleicher Name, anderer Inhalt: "geaendert", wird als Kopie mit Zusatz "(Import)" angelegt
 * - sonst: "neu"
 * Bestehende Vorlagen werden nie überschrieben.
 */
export function planImport(existing: Template[], incoming: ExportedTemplate[]): ImportItem[] {
  const current = existing.filter((t) => !t.deleted);
  const byKey = new Map(current.map((t) => [key(t.name, t.category), t]));
  const taken = new Set(current.map((t) => key(t.name, t.category)));
  const seen = new Set<string>();
  const items: ImportItem[] = [];

  for (const t of incoming) {
    const k = key(t.name, t.category);
    const signature = `${k}\u0000${t.subject}\u0000${t.html}`;
    if (seen.has(signature)) continue; // doppelt in der Datei
    seen.add(signature);

    const match = byKey.get(k);
    if (match && match.subject === t.subject && match.html.trim() === t.html.trim()) {
      items.push({ template: t, status: "vorhanden", targetName: t.name });
      continue;
    }
    let targetName = t.name;
    if (taken.has(k)) {
      targetName = `${t.name} (Import)`;
      for (let i = 2; taken.has(key(targetName, t.category)); i++) targetName = `${t.name} (Import ${i})`;
    }
    taken.add(key(targetName, t.category));
    items.push({ template: t, status: match ? "geaendert" : "neu", targetName });
  }
  return items;
}

/** Erzeugt neue Vorlagen aus den gewählten Einträgen. html wird über clean bereinigt. */
export function toTemplates(items: ImportItem[], clean: (html: string) => string, now = new Date()): Template[] {
  return items
    .filter((i) => i.status !== "vorhanden")
    .map((i) => ({
      id: newId(),
      name: i.targetName,
      category: i.template.category,
      subject: i.template.subject,
      html: clean(i.template.html),
      modified: now.toISOString(),
    }));
}

/** UTF-8-Text als Base64, z. B. für Anhänge. */
export function toBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}
