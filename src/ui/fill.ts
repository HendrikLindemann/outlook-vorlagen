import type { Template } from "../core/model";
import { buildSalutation, parseName, SALUTATION_FORMS, SalutationForm } from "../core/names";
import { analyze, fill, FillContext } from "../core/placeholders";
import { sanitize } from "../core/sanitize";
import type { Person } from "../host";
import type { App } from "./app";
import { errorText, field, h, toast } from "./dom";

export function renderFill(app: App, template: Template): HTMLElement {
  const analysis = analyze(template.subject, template.html);
  const values: Record<string, string> = {};
  const sender = app.host.getSender();
  const person = { form: "neutral" as SalutationForm, titel: "", vorname: "", nachname: "", email: "" };
  let recipients: Person[] = [];
  let currentSubject = "";
  let setSubject = false;

  const preview = h("div", { class: "preview" });
  const subjectLine = h("label", { class: "check" });
  const recipientBox = h("div", {});

  const context = (): FillContext => ({
    now: new Date(),
    salutation: buildSalutation(person.form, person),
    recipient: {
      name: [person.vorname, person.nachname].filter(Boolean).join(" "),
      vorname: person.vorname,
      nachname: person.nachname,
      titel: person.titel,
      email: person.email,
    },
    sender,
    subject: currentSubject,
  });

  const update = () => {
    const ctx = context();
    preview.innerHTML = sanitize(fill(template.html, ctx, values, true));
    if (template.subject) {
      subjectLine.replaceChildren(
        h("input", {
          type: "checkbox",
          checked: setSubject,
          onChange: (e: Event) => (setSubject = (e.target as HTMLInputElement).checked),
        }),
        `Betreff setzen: ${fill(template.subject, ctx, values, false)}`,
      );
    }
  };

  const choose = (r: Person | undefined) => {
    const memo = r && app.store.doc.salutations[r.email.toLowerCase()];
    const parsed = r ? parseName(r.name, r.email) : { titel: "", vorname: "", nachname: "" };
    Object.assign(person, memo ?? { ...parsed, form: parsed.nachname ? "gutenTag" : "neutral" }, { email: r?.email ?? "" });
    drawRecipient();
    update();
  };

  const text = (key: "titel" | "vorname" | "nachname") =>
    h("input", {
      type: "text",
      value: person[key],
      onInput: (e: Event) => {
        person[key] = (e.target as HTMLInputElement).value.trim();
        update();
      },
    });

  function drawRecipient() {
    if (!analysis.usesRecipient) return;
    recipientBox.replaceChildren(
      h("h2", {}, "Empfänger"),
      recipients.length > 1
        ? field(
            "Empfänger",
            h(
              "select",
              { onChange: (e: Event) => choose(recipients[Number((e.target as HTMLSelectElement).value)]) },
              ...recipients.map((r, i) => h("option", { value: String(i), selected: r.email === person.email }, r.name || r.email)),
            ),
          )
        : h("p", { class: "muted" }, recipients[0] ? recipients[0].email : "Noch kein Empfänger eingetragen."),
      field(
        "Anredeform",
        h(
          "select",
          {
            onChange: (e: Event) => {
              person.form = (e.target as HTMLSelectElement).value as SalutationForm;
              update();
            },
          },
          ...SALUTATION_FORMS.map((f) => h("option", { value: f.id, selected: f.id === person.form }, f.label)),
        ),
      ),
      h("div", { class: "cols" }, field("Titel", text("titel")), field("Vorname", text("vorname"))),
      field("Nachname", text("nachname")),
    );
  }

  const customFields = analysis.fields.map((f) => {
    const onInput = (e: Event) => {
      values[f.key] = (e.target as HTMLInputElement | HTMLSelectElement).value;
      update();
    };
    if (f.options.length) {
      values[f.key] = f.options[0];
      return field(f.label, h("select", { onChange: onInput }, ...f.options.map((o) => h("option", { value: o }, o))));
    }
    return field(f.label, h("input", { type: "text", onInput }));
  });

  const rememberSalutation = () => {
    if (!analysis.usesRecipient || !person.email) return;
    const key = person.email.toLowerCase();
    const old = app.store.doc.salutations[key];
    const { form, titel, vorname, nachname } = person;
    if (old && old.form === form && old.titel === titel && old.vorname === vorname && old.nachname === nachname) return;
    app.store
      .mutate((doc) => (doc.salutations[key] = { form, titel, vorname, nachname, modified: new Date().toISOString() }))
      .catch((e) => console.warn("Anrede konnte nicht gespeichert werden", e));
  };

  const insertButton = h(
    "button",
    {
      class: "primary",
      onClick: async () => {
        insertButton.disabled = true;
        try {
          const ctx = context();
          await app.host.insertHtml(sanitize(fill(template.html, ctx, values, true)));
          if (template.subject && setSubject) await app.host.setSubject(fill(template.subject, ctx, values, false));
          rememberSalutation();
          toast(app.host.inOutlook ? "Vorlage eingefügt." : "Demo-Modus: außerhalb von Outlook wird nichts eingefügt.");
          app.go({ name: "list" });
        } catch (e) {
          insertButton.disabled = false;
          toast(errorText(e), "error");
        }
      },
    },
    "Einfügen",
  );

  update();
  Promise.all([app.host.getRecipients().catch(() => []), app.host.getSubject().catch(() => "")]).then(([list, subject]) => {
    recipients = list;
    currentSubject = subject;
    setSubject = !subject.trim();
    choose(recipients[0]);
  });

  return h(
    "section",
    { class: "view" },
    h(
      "header",
      {},
      h("button", { class: "icon", title: "Zurück", "aria-label": "Zurück", onClick: () => app.go({ name: "list" }) }, "←"),
      h("h1", {}, template.name),
    ),
    recipientBox,
    customFields.length > 0 && h("h2", {}, "Angaben"),
    ...customFields,
    template.subject && subjectLine,
    h("h2", {}, "Vorschau"),
    preview,
    h("div", { class: "actions" }, insertButton, h("button", { onClick: () => app.go({ name: "list" }) }, "Abbrechen")),
  );
}
