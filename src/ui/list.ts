import { visibleTemplates } from "../core/model";
import { sampleTemplates } from "../core/samples";
import type { App } from "./app";
import { errorText, h, toast } from "./dom";

const STORAGE_LABEL = {
  onedrive: "Speicherort: OneDrive",
  roaming: "Speicherort: Postfach (max. 32 KB)",
  demo: "Demo-Modus außerhalb von Outlook",
};

export function renderList(app: App): HTMLElement {
  const all = visibleTemplates(app.store.doc);
  const listEl = h("div", { class: "list" });

  const draw = () => {
    const q = app.search.trim().toLowerCase();
    const hits = q
      ? all.filter((t) => `${t.name} ${t.category} ${t.subject}`.toLowerCase().includes(q))
      : all;
    listEl.replaceChildren();
    let category: string | undefined;
    for (const t of hits) {
      if (t.category !== category) {
        category = t.category;
        listEl.append(h("h2", {}, category || "Ohne Kategorie"));
      }
      listEl.append(
        h(
          "div",
          { class: "row" },
          h("button", { class: "row-main", title: "Vorlage einfügen", onClick: () => app.go({ name: "fill", template: t }) }, t.name),
          h(
            "button",
            { class: "icon", title: "Bearbeiten", "aria-label": `${t.name} bearbeiten`, onClick: () => app.go({ name: "editor", template: t }) },
            "✎",
          ),
        ),
      );
    }
    if (hits.length === 0 && all.length > 0) listEl.append(h("p", { class: "muted" }, "Keine Vorlage gefunden."));
  };
  draw();

  const empty =
    all.length === 0 &&
    !app.notice &&
    h(
      "div",
      { class: "empty" },
      h("p", {}, "Noch keine Vorlagen vorhanden."),
      h(
        "button",
        {
          onClick: async () => {
            try {
              await app.store.mutate((doc) => doc.templates.push(...sampleTemplates()));
              app.go({ name: "list" });
            } catch (e) {
              toast(errorText(e), "error");
            }
          },
        },
        "Beispielvorlagen anlegen",
      ),
    );

  return h(
    "section",
    { class: "view" },
    h(
      "header",
      {},
      h("h1", {}, "Textvorlagen"),
      h("button", { class: "primary", onClick: () => app.go({ name: "editor" }) }, "+ Neu"),
    ),
    app.notice &&
      h(
        "div",
        { class: "notice" },
        h("p", {}, app.notice),
        h("button", { onClick: () => app.reload(true) }, app.needsSignIn ? "Anmelden" : "Erneut versuchen"),
      ),
    all.length > 0 &&
      h("input", {
        type: "search",
        placeholder: "Suchen …",
        "aria-label": "Vorlagen durchsuchen",
        value: app.search,
        onInput: (e: Event) => {
          app.search = (e.target as HTMLInputElement).value;
          draw();
        },
      }),
    listEl,
    empty,
    h("footer", {}, STORAGE_LABEL[app.store.backend.kind]),
  );
}
