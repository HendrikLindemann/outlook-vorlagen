import { newId, Template } from "./model";

const sample = (name: string, category: string, subject: string, html: string): Template => ({
  id: newId(),
  name,
  category,
  subject,
  html,
  modified: new Date().toISOString(),
});

export const sampleTemplates = (): Template[] => [
  sample(
    "Terminbestätigung",
    "Termine",
    "Terminbestätigung {{Termin}}",
    "<p>{{Anrede}},</p><p>hiermit bestätige ich unseren Termin am <b>{{Termin}}</b> um {{Zeit}} Uhr. " +
      "Der Termin findet {{Ort|in unserem Büro|per Videokonferenz|telefonisch}} statt.</p>" +
      "<p>Mit freundlichen Grüßen<br>{{Absender.Name}}</p>",
  ),
  sample(
    "Unterlagen anfordern",
    "Allgemein",
    "Fehlende Unterlagen",
    "<p>{{Anrede}},</p><p>für die weitere Bearbeitung benötige ich noch folgende Unterlagen:</p>" +
      "<ul><li>{{Unterlage}}</li></ul><p>Bitte senden Sie mir diese bis zum <b>{{Datum+14}}</b> zu.</p>" +
      "<p>Mit freundlichen Grüßen<br>{{Absender.Name}}</p>",
  ),
  sample(
    "Eingangsbestätigung",
    "Allgemein",
    "",
    "<p>{{Anrede}},</p><p>vielen Dank für Ihre Nachricht. Ich habe sie am {{Datum}} erhalten und melde mich " +
      "so bald wie möglich bei Ihnen.</p><p>Mit freundlichen Grüßen<br>{{Absender.Name}}</p>",
  ),
];
