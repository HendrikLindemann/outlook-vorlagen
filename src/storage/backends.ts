import type { DataDoc } from "../core/model";
import { normalizeDoc } from "../core/model";
import type { Host } from "../host";

export class ConflictError extends Error {}
export class AuthRequiredError extends Error {}

export interface Loaded {
  doc: DataDoc | null;
  etag?: string;
}

export interface Backend {
  kind: "onedrive" | "roaming" | "demo";
  load(interactive: boolean): Promise<Loaded>;
  /** Speichert den Stand. Wirft ConflictError, wenn der Speicher inzwischen geändert wurde. */
  save(doc: DataDoc, etag: string | undefined): Promise<string | undefined>;
}

// ---------------------------------------------------------------------------
// Postfach (Roaming Settings): ohne Anmeldung, aber auf 32 KB begrenzt.
// ---------------------------------------------------------------------------

export const ROAMING_KEY = "vorlagen.data";
const ROAMING_LIMIT = 30000; // Zeichen; lässt Reserve unter dem 32-KB-Limit von Outlook

export class RoamingBackend implements Backend {
  kind: "roaming" | "demo";
  constructor(private host: Host) {
    this.kind = host.inOutlook ? "roaming" : "demo";
  }
  async load(): Promise<Loaded> {
    const raw = this.host.roamingGet(ROAMING_KEY);
    return { doc: raw ? normalizeDoc(raw) : null };
  }
  async save(doc: DataDoc): Promise<undefined> {
    if (this.host.inOutlook && JSON.stringify(doc).length > ROAMING_LIMIT) {
      throw new Error(
        "Der Speicher im Postfach ist voll (maximal 32 KB). Richten Sie die OneDrive-Speicherung ein oder löschen Sie Vorlagen.",
      );
    }
    await this.host.roamingSet(ROAMING_KEY, doc);
    return undefined;
  }
}

// ---------------------------------------------------------------------------
// OneDrive-App-Ordner über Microsoft Graph.
// ---------------------------------------------------------------------------

const FILE = "https://graph.microsoft.com/v1.0/me/drive/special/approot:/vorlagen.json";

export class OneDriveBackend implements Backend {
  kind = "onedrive" as const;
  constructor(private getToken: (interactive: boolean) => Promise<string>) {}

  private async request(interactive: boolean, url: string, init: RequestInit = {}): Promise<Response> {
    const token = await this.getToken(interactive);
    return fetch(url, { ...init, headers: { ...(init.headers || {}), Authorization: `Bearer ${token}` } });
  }

  async load(interactive: boolean): Promise<Loaded> {
    const meta = await this.request(interactive, FILE);
    if (meta.status === 404) return { doc: null };
    if (!meta.ok) throw new Error(`OneDrive antwortet mit Fehler ${meta.status}.`);
    const item = (await meta.json()) as Record<string, string>;
    // Der Inhalt wird über die vorab signierte Adresse geladen; "/content" scheitert im Browser an CORS.
    const url = item["@microsoft.graph.downloadUrl"];
    if (!url) throw new Error("OneDrive hat keine Download-Adresse geliefert.");
    const content = await fetch(url);
    if (!content.ok) throw new Error(`Vorlagendatei konnte nicht geladen werden (${content.status}).`);
    return { doc: normalizeDoc(await content.json()), etag: item.eTag };
  }

  async save(doc: DataDoc, etag: string | undefined): Promise<string | undefined> {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (etag) headers["If-Match"] = etag;
    const res = await this.request(false, `${FILE}:/content`, {
      method: "PUT",
      headers,
      body: JSON.stringify(doc),
    });
    if (res.status === 412 || res.status === 409) throw new ConflictError();
    if (!res.ok) throw new Error(`Speichern in OneDrive fehlgeschlagen (${res.status}).`);
    return ((await res.json()) as { eTag?: string }).eTag;
  }
}
