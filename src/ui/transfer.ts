import { visibleTemplates } from "../core/model";
import { sanitize } from "../core/sanitize";
import { buildExport, exportFileName, ImportItem, parseImport, planImport, toBase64, toTemplates } from "../core/transfer";
import type { App } from "./app";
import { errorText, h, toast } from "./dom";

const STATUS_LABEL = { neu: "neu", vorhanden: "schon vorhanden", geaendert: "als Kopie" };
const STATUS_HINT = {
  neu: "Wird neu angelegt.",
  vorhanden: "Eine gleiche Vorlage ist schon vorhanden.",
  geaendert: "Eine Vorlage mit diesem Namen, aber anderem Inhalt ist vorhanden. Die importierte Fassung wird als Kopie angelegt.",
};

export function renderTransfer(app: App): HTMLElement {
  const templates = visibleTemplates(app.store.doc);

  // ---------------- Export ----------------
  const selected = new Set(templates.map((t) => t.id));
  const exportList = h(
    "div",
    { class: "checklist" },
    ...templates.map((t) =>
      h(
        "label",
        {},
        h("input", {
          type: "checkbox",
          checked: true,
          onChange: (e: Event) => {
            if ((e.target as HTMLInputElement).checked) selected.add(t.id);
            else selected.delete(t.id);
          },
        }),
        t.category ? `${t.category}: ${t.name}` : t.name,
      ),
    ),
  );

  const exportText = () => {
    const chosen = templates.filter((t) => selected.has(t.id));
    if (chosen.length === 0) throw new Error("Bitte mindestens eine Vorlage auswählen.");
    return { text: JSON.stringify(buildExport(chosen), null, 2), count: chosen.length };
  };

  const attachButton = h(
    "button",
    {
      class: "primary",
      onClick: async () => {
        try {
          const { text, count } = exportText();
          await app.host.addAttachment(exportFileName(), toBase64(text));
          toast(`${count} Vorlage(n) als Anhang an diese E-Mail angefügt.`);
        } catch (e) {
          toast(errorText(e), "error");
        }
      },
    },
    "An diese E-Mail anhängen",
  );

  const downloadButton = h(
    "button",
    {
      onClick: () => {
        try {
          const { text } = exportText();
          const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
          const a = h("a", { href: url, download: exportFileName() });
          document.body.append(a);
          a.click();
          a.remove();
          setTimeout(() => URL.revokeObjectURL(url), 10000);
        } catch (e) {
          toast(errorText(e), "error");
        }
      },
    },
    "Als Datei speichern",
  );

  // ---------------- Import ----------------
  const importArea = h("div", { class: "view-part" });
  const fileInput = h("input", {
    type: "file",
    accept: ".json,application/json",
    class: "file-input",
    "aria-label": "Vorlagen-Datei auswählen",
    onChange: async () => {
      const file = fileInput.files?.[0];
      fileInput.value = "";
      if (!file) return;
      try {
        showPlan(planImport(app.store.doc.templates, parseImport(await file.text())));
      } catch (e) {
        importArea.replaceChildren();
        toast(errorText(e), "error");
      }
    },
  });

  function showPlan(items: ImportItem[]) {
    const chosen = new Set(items.filter((i) => i.status !== "vorhanden"));
    const newCount = chosen.size;
    const importButton = h(
      "button",
      {
        class: "primary",
        disabled: newCount === 0,
        onClick: async () => {
          const list = items.filter((i) => chosen.has(i));
          if (list.length === 0) return toast("Keine Vorlage ausgewählt.", "error");
          importButton.disabled = true;
          try {
            const created = toTemplates(list, sanitize);
            await app.store.mutate((doc) => doc.templates.push(...created));
            toast(`${created.length} Vorlage(n) importiert.`);
            app.go({ name: "list" });
          } catch (e) {
            importButton.disabled = false;
            toast(errorText(e), "error");
          }
        },
      },
      "Importieren",
    );
    importArea.replaceChildren(
      h(
        "p",
        { class: "muted" },
        newCount === 0
          ? "Alle Vorlagen aus der Datei sind bereits vorhanden."
          : `${items.length} Vorlage(n) in der Datei, ${newCount} davon neu oder geändert. Vorhandene Vorlagen werden nicht überschrieben; bei gleichem Namen mit anderem Inhalt entsteht eine Kopie mit dem Zusatz „(Import)“.`,
      ),
      h(
        "div",
        { class: "checklist" },
        ...items.map((i) =>
          h(
            "label",
            {},
            h("input", {
              type: "checkbox",
              checked: chosen.has(i),
              disabled: i.status === "vorhanden",
              onChange: (e: Event) => {
                if ((e.target as HTMLInputElement).checked) chosen.add(i);
                else chosen.delete(i);
              },
            }),
            i.template.category ? `${i.template.category}: ${i.targetName}` : i.targetName,
            h("span", { class: `tag ${i.status}`, title: STATUS_HINT[i.status] }, STATUS_LABEL[i.status]),
          ),
        ),
      ),
      h("div", { class: "actions" }, importButton),
    );
  }

  return h(
    "section",
    { class: "view" },
    h(
      "header",
      {},
      h("button", { class: "icon", title: "Zurück", "aria-label": "Zurück", onClick: () => app.go({ name: "list" }) }, "←"),
      h("h1", {}, "Exportieren / Importieren"),
    ),
    h("h2", {}, "Exportieren"),
    templates.length === 0
      ? h("p", { class: "muted" }, "Keine Vorlagen vorhanden.")
      : h(
          "div",
          { class: "view-part" },
          h("p", { class: "muted" }, "Exportiert werden nur die gewählten Vorlagen, keine gemerkten Anreden."),
          exportList,
          h("div", { class: "actions" }, app.host.canAttach && attachButton, downloadButton),
        ),
    h("h2", {}, "Importieren"),
    h("p", { class: "muted" }, "Datei aus einem Export wählen. Vorhandene Vorlagen bleiben erhalten."),
    h("div", { class: "actions" }, h("button", { onClick: () => fileInput.click() }, "Datei auswählen …"), fileInput),
    importArea,
  );
}
