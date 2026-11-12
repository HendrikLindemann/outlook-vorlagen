import DOMPurify from "dompurify";

/** Entfernt aktive Inhalte (Skripte, Formulare, Ereignisattribute), Formatierung bleibt erhalten. */
export function sanitize(html: string): string {
  return DOMPurify.sanitize(html, {
    FORBID_TAGS: ["style", "form", "input", "button", "select", "textarea", "iframe", "object", "embed"],
  }).trim();
}
