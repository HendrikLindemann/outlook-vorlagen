type Child = Node | string | null | undefined | false;
type Props = Record<string, unknown>;

/** Erzeugt ein DOM-Element. Eigenschaften mit "on…" werden als Ereignisbehandler registriert. */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Props = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value === undefined || value === null || value === false) continue;
    if (key.startsWith("on") && typeof value === "function") {
      el.addEventListener(key.slice(2).toLowerCase(), value as EventListener);
    } else if (key === "class") {
      el.className = String(value);
    } else if (key in el && key !== "list") {
      (el as unknown as Props)[key] = value;
    } else {
      el.setAttribute(key, value === true ? "" : String(value));
    }
  }
  for (const c of children) if (c) el.append(c);
  return el;
}

let toastTimer: number | undefined;

export function toast(message: string, kind: "info" | "error" = "info") {
  let el = document.getElementById("toast");
  if (!el) {
    el = h("div", { id: "toast", role: "status" });
    document.body.append(el);
  }
  el.textContent = message;
  el.className = `show ${kind}`;
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => (el!.className = ""), kind === "error" ? 7000 : 2500);
}

export const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e));

let fieldCounter = 0;

/** Beschriftetes Eingabefeld; Beschriftung und Feld sind über id verknüpft. */
export function field(label: string, control: HTMLElement): HTMLElement {
  control.id ||= `f${++fieldCounter}`;
  return h("div", { class: "field" }, h("label", { htmlFor: control.id }, label), control);
}
