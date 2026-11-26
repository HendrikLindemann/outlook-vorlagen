# Textvorlagen – Hinweise für Änderungen

Outlook-Web-Add-in (Office.js, **Verfassen**-Modus) für formatierte E-Mail-Textvorlagen mit Platzhaltern. Für alle
Benutzer des Mandanten SBHL als Organisations-Add-in installiert. Antworten auf Deutsch; der Benutzer führt Schritte
am eigenen Rechner selbst aus (nummerierte Anleitungen, je Befehl ein Codeblock, PowerShell 7) und committet mit
GitHub Desktop. Hintergrundwissen: Skill `outlook-addin-entwicklung`. Schwesterprojekt: `D:\Projekte\outlook-mail-ablage`
(Lese-Add-in „Mail-Ablage", eigene `CLAUDE.md`).

## Eckdaten

| | |
|---|---|
| Repository | `HendrikLindemann/outlook-vorlagen` (öffentlich), Branch `main` |
| Veröffentlicht | `https://hendriklindemann.github.io/outlook-vorlagen/` (GitHub Pages über Actions) |
| Manifest | `manifest.template.xml` → `dist/manifest.xml`, Add-in-ID `7c1f6c0e-3b52-4d0a-9a41-5e8d2f4b6a90`, Version 1.0.2.0, `MessageComposeCommandSurface`, `ReadWriteItem`, Mailbox 1.3 |
| App-Registrierung | Client-ID `732ef417-3655-4109-b880-c6492fd5586d`, nur Mandant `a7d6612e-dc90-4650-b8be-19612e7eadcb`; delegiert `Files.ReadWrite.AppFolder` |
| Konfiguration | `public/config.json` (`clientId`, `authority`) |
| Daten | je Benutzer: OneDrive-App-Ordner `vorlagen.json` (mit NAA) bzw. Roaming Settings `vorlagen.data` (max. 32 KB). Vorlagen sind persönlich, nicht gemeinsam |

## Aufbau

- `src/core/` – Logik ohne Outlook-Bezug: Datenmodell (`model.ts`), Platzhalter (`placeholders.ts`), Namen/Anrede (`names.ts`), Bereinigung (`sanitize.ts`), Export/Import (`transfer.ts`), Beispielvorlagen
- `src/host.ts` – alle Office.js-Zugriffe und Demo-Host für den Browser
- `src/storage/` – Speicherorte (`backends.ts`: Roaming/OneDrive mit ETag), Abgleich und Übernahme (`store.ts`), Anmeldung (`auth.ts`)
- `src/ui/` – Liste, Editor, Ausfüllen, Export/Import
- `scripts/verteilen.ps1` – Installation als Organisations-Add-in (liest ID und Version aus dem Manifest)

## Befehle

```powershell
npm install
npm test           # Vitest
npm run build      # tsc + vite build + dist/manifest.xml
npm run dev        # https://localhost:3000, schreibt manifest.dev.xml
```

Vor jedem Push: `npm test` und `npm run build` müssen grün sein (laufen auch in `deploy.yml`).

## Änderungen ausrollen

**Nur Code, Oberfläche oder `config.json`** (neue Platzhalter, Editor, Export …):
1. Ändern, Tests anpassen, lokal prüfen.
2. Benutzer committet und pusht mit GitHub Desktop.
3. `deploy.yml` veröffentlicht automatisch (Jobs `build` und `deploy`); Outlook lädt die neue Version beim nächsten
   Öffnen. Keine Neuinstallation.
4. Prüfen: Actions-Lauf grün (`https://api.github.com/repos/HendrikLindemann/outlook-vorlagen/actions/runs?per_page=3`),
   geänderte Datei unter der Pages-Adresse abrufen.

**Datenmodell:** Gespeicherte Vorlagen aller Benutzer müssen weiter lesbar bleiben – `normalizeDoc` in
`src/core/model.ts` rückwärtskompatibel erweitern, nicht umbauen. Roaming-Grenze 32 KB beachten.

**Manifest** (Name, Schaltfläche, Berechtigungen, ExtensionPoints, Mindestversion):
1. In `manifest.template.xml` ändern und **`<Version>` erhöhen**. Die `<Id>` nie ändern.
2. `npm run build`, dann `npx office-addin-manifest validate dist/manifest.xml`.
3. Commit, Push, warten bis Deploy grün ist und `…/manifest.xml` die neue Version zeigt.
4. Benutzer verteilt neu (PowerShell 7, im Projektordner). Anmeldung im Claude-Terminal per Gerätecode, weil das
   Windows-Anmeldefenster dort nicht erscheint:
   ```powershell
   Import-Module ExchangeOnlineManagement
   ```
   ```powershell
   Connect-ExchangeOnline -Device
   ```
   ```powershell
   .\scripts\verteilen.ps1 -Alle -WhatIf
   ```
   ```powershell
   .\scripts\verteilen.ps1 -Alle
   ```
   Die Ausgabe muss die neue `AppVersion` zeigen, sonst hat GitHub Pages noch die alte Datei – zwei Minuten warten,
   wiederholen.
5. Neue Add-ins und Updates erreichen die Postfächer laut Microsoft erst nach **bis zu 72 Stunden** (auch
   `Get-App -Mailbox` zeigt so lange den alten Stand). In dieser Zeit nichts neu installieren – das startet die Frist neu.

**Graph-Berechtigungen** zusätzlich: in Entra unter App-Registrierungen › API-Berechtigungen ergänzen und
Administratorzustimmung erteilen; `SCOPES` in `src/storage/auth.ts` anpassen.

## Bekannte Grenzen

- Erscheint nur beim Verfassen (neue Mail, Antwort), nicht beim Lesen. In freigegebenen Postfächern beim Verfassen
  ohne Zusatz im Manifest verfügbar (Web, Windows).
- Outlook für iOS/Android zeigt Verfassen-Add-ins nicht.
- Eingebettete Bilder in Vorlagen werden nicht unterstützt.
- Outlook liefert kein Geschlecht; die Anrede wird je E-Mail-Adresse gemerkt.

## Stand (26.11.2026)

Version 1.0.2.0 am 22.11. als Organisations-Add-in an alle verteilt; in den Postfächern erst nach rund 72 Stunden
angekommen (`Get-App -Mailbox` zeigt 1.0.2.0). `deploy.yml` auf zwei Jobs umgestellt (Fehler
actions/deploy-pages#451 beim Veröffentlichen im selben Job).
