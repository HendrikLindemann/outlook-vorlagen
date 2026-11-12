import { newId, Template, visibleTemplates } from "../core/model";
import { BUILTIN_PLACEHOLDERS } from "../core/placeholders";
import { sanitize } from "../core/sanitize";
import type { App } from "./app";
import { errorText, field, h, toast } from "./dom";

export function renderEditor(app: App, existing?: Template): HTMLElement {
  const categories = [...new Set(visibleTemplates(app.store.doc).map((t) => t.category).filter(Boolean))];
  const name = h("input", { type: "text", value: existing?.name ?? "", required: true });
  const category = h("input", { type: "text", value: existing?.category ?? "", list: "categories" });
  const subject = h("input", { type: "text", value: existing?.subject ?? "", placeholder: "optional, Platzhalter möglich" });
  const body = h("div", { class: "editor", contentEditable: "true", role: "textbox", "aria-multiline": "true", "aria-label": "Vorlagentext" });
  body.innerHTML = sanitize(existing?.html ?? "<p>{{Anrede}},</p><p><br></p>");

  // Die Auswahl im Text merken, weil Auswahlliste und Link-Feld den Fokus übernehmen.
  let savedRange: Range | undefined;
  const saveRange = () => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount && body.contains(sel.anchorNode)) savedRange = sel.getRangeAt(0).cloneRange();
  };
  for (const ev of ["keyup", "mouseup", "blur", "input"]) body.addEventListener(ev, saveRange);
  const restoreRange = () => {
    const sel = window.getSelection();
    if (document.activeElement === body && sel?.rangeCount && body.contains(sel.anchorNode)) return;
    body.focus();
    if (!savedRange) return;
    sel?.removeAllRanges();
    sel?.addRange(savedRange);
  };
  const exec = (command: string, value?: string) => {
    restoreRange();
    document.execCommand(command, false, value);
    saveRange();
  };

  const tool = (label: string, title: string, command: string, cls = "") =>
    h(
      "button",
      { type: "button", class: `tool ${cls}`, title, "aria-label": title, onMousedown: (e: Event) => e.preventDefault(), onClick: () => exec(command) },
      label,
    );

  const linkInput = h("input", { type: "url", placeholder: "https://…", "aria-label": "Linkadresse" });
  const linkRow = h(
    "div",
    { class: "link-row", hidden: true },
    linkInput,
    h(
      "button",
      {
        type: "button",
        onClick: () => {
          const url = linkInput.value.trim();
          if (/^(https?:|mailto:)/i.test(url)) exec("createLink", url);
          else if (url) toast("Bitte eine Adresse mit https:// oder mailto: eingeben.", "error");
          linkInput.value = "";
          linkRow.hidden = true;
        },
      },
      "OK",
    ),
  );

  const placeholderSelect = h(
    "select",
    {
      class: "tool-select",
      "aria-label": "Platzhalter einfügen",
      onChange: (e: Event) => {
        const select = e.target as HTMLSelectElement;
        if (select.value) exec("insertText", select.value);
        select.value = "";
      },
    },
    h("option", { value: "" }, "Platzhalter …"),
    ...BUILTIN_PLACEHOLDERS.map((p) => h("option", { value: p.token }, p.hint ? `${p.token} – ${p.hint}` : p.token)),
  );

  const save = async () => {
    const html = sanitize(body.innerHTML);
    if (!name.value.trim()) {
      name.focus();
      return toast("Bitte einen Namen eingeben.", "error");
    }
    if (!body.textContent?.trim()) return toast("Der Vorlagentext ist leer.", "error");
    const template: Template = {
      id: existing?.id ?? newId(),
      name: name.value.trim(),
      category: category.value.trim(),
      subject: subject.value.trim(),
      html,
      modified: new Date().toISOString(),
    };
    saveButton.disabled = true;
    try {
      await app.store.mutate((doc) => {
        doc.templates = doc.templates.filter((t) => t.id !== template.id);
        doc.templates.push(template);
      });
      toast("Vorlage gespeichert.");
      app.go({ name: "list" });
    } catch (e) {
      saveButton.disabled = false;
      toast(errorText(e), "error");
    }
  };
  const saveButton = h("button", { class: "primary", onClick: save }, "Speichern");

  let confirmDelete = false;
  const deleteButton = h(
    "button",
    {
      class: "danger",
      onClick: async () => {
        if (!confirmDelete) {
          confirmDelete = true;
          deleteButton.textContent = "Wirklich löschen?";
          return;
        }
        try {
          await app.store.mutate((doc) => {
            const t = doc.templates.find((x) => x.id === existing!.id);
            if (t) Object.assign(t, { deleted: true, html: "", modified: new Date().toISOString() });
          });
          toast("Vorlage gelöscht.");
          app.go({ name: "list" });
        } catch (e) {
          toast(errorText(e), "error");
        }
      },
    },
    "Löschen",
  );

  return h(
    "section",
    { class: "view" },
    h(
      "header",
      {},
      h("button", { class: "icon", title: "Zurück", "aria-label": "Zurück", onClick: () => app.go({ name: "list" }) }, "←"),
      h("h1", {}, existing ? "Vorlage bearbeiten" : "Neue Vorlage"),
    ),
    field("Name", name),
    field("Kategorie", category),
    h("datalist", { id: "categories" }, ...categories.map((c) => h("option", { value: c }))),
    field("Betreff", subject),
    h(
      "div",
      { class: "toolbar" },
      tool("F", "Fett", "bold", "b"),
      tool("K", "Kursiv", "italic", "i"),
      tool("U", "Unterstrichen", "underline", "u"),
      tool("•", "Aufzählung", "insertUnorderedList"),
      tool("1.", "Nummerierung", "insertOrderedList"),
      h(
        "button",
        {
          type: "button",
          class: "tool",
          title: "Link",
          "aria-label": "Link einfügen",
          onMousedown: (e: Event) => e.preventDefault(),
          onClick: () => {
            linkRow.hidden = !linkRow.hidden;
            if (!linkRow.hidden) linkInput.focus();
          },
        },
        "🔗",
      ),
      tool("⌫", "Formatierung entfernen", "removeFormat"),
      placeholderSelect,
    ),
    linkRow,
    body,
    h(
      "button",
      {
        class: "link",
        onClick: async () => {
          try {
            const html = sanitize(await app.host.getBodyHtml());
            if (!html) return toast("Die aktuelle E-Mail ist leer.", "error");
            body.innerHTML = html;
            toast("Text der aktuellen E-Mail übernommen.");
          } catch (e) {
            toast(errorText(e), "error");
          }
        },
      },
      "Text der aktuellen E-Mail übernehmen",
    ),
    h(
      "div",
      { class: "actions" },
      saveButton,
      h("button", { onClick: () => app.go({ name: "list" }) }, "Abbrechen"),
      existing && deleteButton,
    ),
  );
}
