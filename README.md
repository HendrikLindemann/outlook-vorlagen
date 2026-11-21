# Textvorlagen für Outlook

Outlook-Add-in (Office.js) für formatierte E-Mail-Textvorlagen mit Platzhaltern. Läuft im klassischen Outlook für Windows, im neuen Outlook, in Outlook im Web und auf dem Mac.

## Funktionen

- Schaltfläche „Vorlagen" im Menüband neuer E-Mails und Antworten öffnet den Taskpane.
- Vorlagen mit Name, Kategorie, optionalem Betreff und formatiertem Text; Suche über alle Vorlagen.
- Editor mit Fett, Kursiv, Unterstrichen, Listen, Links; alternativ den Text der aktuellen E-Mail übernehmen.
- Platzhalter werden beim Einfügen gefüllt, mit Vorschau.
- Die gewählte Anrede wird je E-Mail-Adresse gemerkt.
- Export ausgewählter Vorlagen als Anhang an die aktuelle E-Mail oder als Datei; Import mit Vorschau, ohne vorhandene Vorlagen zu überschreiben. Gemerkte Anreden werden nicht exportiert.
- Speicherung im OneDrive-App-Ordner (`Apps/<Name der App>/vorlagen.json`) oder, ohne Einrichtung, im Postfach (maximal 32 KB).

## Platzhalter

| Platzhalter | Ergebnis |
|---|---|
| `{{Anrede}}` | Briefanrede ohne Komma, z. B. „Sehr geehrte Frau Müller" |
| `{{Empfänger.Name}}`, `.Vorname`, `.Nachname`, `.Titel`, `.Email` | Angaben zum ersten bzw. gewählten Empfänger |
| `{{Absender.Name}}`, `{{Absender.Email}}` | eigenes Profil |
| `{{Datum}}`, `{{Datum+14}}`, `{{Datum-7}}` | Datum als TT.MM.JJJJ, mit Tagesversatz |
| `{{Datum.Lang}}`, `{{Datum.Lang+14}}` | z. B. „12. November 2026" |
| `{{Wochentag}}`, `{{Monat}}`, `{{Jahr}}`, `{{Uhrzeit}}` | aktuelle Zeitangaben |
| `{{Betreff}}` | Betreff der E-Mail |
| `{{Beliebiger Name}}` | freies Feld, wird beim Einfügen abgefragt |
| `{{Name\|Option A\|Option B}}` | Auswahlliste |

Schreibweise mit Umlaut oder Umschrift (`Empfänger` / `Empfaenger`), Groß- und Kleinschreibung sind egal. Leere Felder bleiben als `{{Name}}` im Text stehen.

## Einrichtung

### 1. Lokal testen

Voraussetzung: [Node.js](https://nodejs.org) ab Version 20.

```bash
npm install
```

```bash
npm run certs
```

```bash
npm run dev
```

`npm run certs` installiert einmalig ein vertrauenswürdiges Entwicklerzertifikat für `https://localhost:3000` und fragt dafür nach Administratorrechten. `npm run dev` startet den Server und schreibt `manifest.dev.xml`.

Add-in installieren: <https://aka.ms/olksideload> öffnen, „Meine Add-Ins" > „Benutzerdefinierte Add-Ins" > „Aus Datei hinzufügen" und `manifest.dev.xml` wählen. Das Add-in erscheint danach in allen Outlook-Varianten des Kontos. In einer neuen E-Mail liegt die Schaltfläche „Vorlagen" im Menüband, im neuen Outlook und im Web gegebenenfalls unter „Apps".

Ohne weitere Einrichtung speichert das Add-in im Postfach (Fußzeile: „Speicherort: Postfach").

### 2. Dauerhaft hosten (GitHub Pages)

1. Auf GitHub ein Repository anlegen und dieses Projekt hochladen. GitHub Pages setzt im kostenlosen Tarif ein öffentliches Repository voraus. Das Projekt enthält keine Geheimnisse.
2. Im Repository unter Settings > Pages als Quelle „GitHub Actions" wählen.
3. Der Workflow `.github/workflows/deploy.yml` baut und veröffentlicht bei jedem Push auf `main`.
4. Das fertige Manifest liegt unter `https://<Benutzer>.github.io/<Repository>/manifest.xml`. Herunterladen und wie in Schritt 1 installieren; das Entwicklungs-Add-in vorher entfernen.

Jeder andere statische HTTPS-Webspace funktioniert ebenso:

```bash
ADDIN_BASE_URL=https://meine-adresse.example/vorlagen npm run build
```

Danach den Inhalt von `dist/` hochladen.

### 3. OneDrive-Speicherung aktivieren (Entra-App-Registrierung)

1. <https://entra.microsoft.com> > App-Registrierungen > „Neue Registrierung".
2. Name: z. B. „Outlook Textvorlagen". Der Name bestimmt den Ordnernamen in OneDrive.
3. Unterstützte Kontotypen: „Konten in einem beliebigen Organisationsverzeichnis und persönliche Microsoft-Konten". Wer nur den eigenen Mandanten zulassen will, wählt „Nur dieses Verzeichnis" und trägt in `public/config.json` als `authority` `https://login.microsoftonline.com/<Mandanten-ID>` ein.
4. Umleitungs-URI, Plattform „Single-Page-Anwendung (SPA)": `brk-multihub://<Benutzer>.github.io` (nur der Hostname, ohne Pfad). Für lokale Tests zusätzlich `brk-multihub://localhost:3000`.
5. API-Berechtigungen > Microsoft Graph > Delegierte Berechtigungen > `Files.ReadWrite.AppFolder` hinzufügen.
6. Die „Anwendungs-ID (Client)" aus der Übersicht in `public/config.json` bei `clientId` eintragen und neu veröffentlichen.

Beim nächsten Öffnen zeigt die Fußzeile „Speicherort: OneDrive". Vorlagen aus dem Postfach werden automatisch übernommen. Erscheint „Anmeldung nötig", einmal auf „Anmelden" klicken und zustimmen. Verlangt der Mandant eine Administratorzustimmung, muss ein Administrator die Berechtigung unter „API-Berechtigungen" freigeben.

Unterstützt die Outlook-Version keine Nested App Authentication (ältere Builds), bleibt das Add-in bei der Speicherung im Postfach.

## Entwicklung

| Befehl | Zweck |
|---|---|
| `npm run dev` | Entwicklungsserver auf `https://localhost:3000` |
| `npm test` | Unit-Tests (Platzhalter, Namen, Abgleich, OneDrive-Zugriff) |
| `npm run build` | Typprüfung, Build nach `dist/`, Manifest erzeugen |
| `npm run validate` | Manifest beim Microsoft-Prüfdienst validieren |

Außerhalb von Outlook läuft die Seite im Demo-Modus mit Beispielempfänger und Speicherung im Browser.

Aufbau: `src/core` enthält die Logik ohne Outlook-Bezug, `src/host.ts` kapselt Office.js, `src/storage` die Speicherorte, `src/ui` die Ansichten. Das Manifest entsteht aus `manifest.template.xml`.

## Bekannte Grenzen

- Eingebettete Bilder werden nicht unterstützt; verlinkte Bilder (`https://…`) bleiben erhalten.
- Outlook für iOS und Android zeigt Add-ins beim Verfassen nicht an.
- Die Anrede lässt sich nicht automatisch bestimmen, weil Outlook kein Geschlecht liefert. Die Form wird beim ersten Mal gewählt und dann gemerkt.
