import { DataDoc, emptyDoc, mergeDocs, normalizeDoc } from "../core/model";
import type { Host } from "../host";
import { createTokenProvider } from "./auth";
import { Backend, ConflictError, OneDriveBackend, ROAMING_KEY, RoamingBackend } from "./backends";

export interface AppConfig {
  clientId: string;
  authority: string;
}

const CACHE_KEY = "vorlagen.cache";

/** Hält den aktuellen Datenstand und gleicht ihn mit dem gewählten Speicher ab. */
export class Store {
  doc: DataDoc = emptyDoc();
  loaded = false;
  private etag: string | undefined;

  constructor(
    public backend: Backend,
    private host: Host,
  ) {
    try {
      const cached = localStorage.getItem(`${CACHE_KEY}.${backend.kind}`);
      if (cached) this.doc = normalizeDoc(JSON.parse(cached));
    } catch {
      /* Cache ist optional */
    }
  }

  private cache() {
    try {
      localStorage.setItem(`${CACHE_KEY}.${this.backend.kind}`, JSON.stringify(this.doc));
    } catch {
      /* Cache ist optional */
    }
  }

  async load(interactive = false): Promise<void> {
    const { doc, etag } = await this.backend.load(interactive);
    this.doc = doc ?? emptyDoc();
    this.etag = etag;
    this.loaded = true;
    this.cache();
    await this.adoptRoamingData();
  }

  /** Übernimmt Vorlagen, die vor der OneDrive-Einrichtung im Postfach lagen. */
  private async adoptRoamingData() {
    if (this.backend.kind !== "onedrive") return;
    const raw = this.host.roamingGet(ROAMING_KEY);
    if (!raw) return;
    const old = normalizeDoc(raw);
    await this.mutate((doc) => Object.assign(doc, mergeDocs(doc, old)));
    await this.host.roamingSet(ROAMING_KEY, undefined);
  }

  /** Wendet eine Änderung an und speichert. Bei gleichzeitiger Änderung auf einem anderen Gerät wird zusammengeführt. */
  async mutate(change: (doc: DataDoc) => void): Promise<void> {
    if (!this.loaded) await this.load(true);
    const next = normalizeDoc(JSON.parse(JSON.stringify(this.doc)));
    change(next);
    let candidate = mergeDocs(next, emptyDoc()); // entfernt abgelaufene Löschmarken
    for (let attempt = 0; ; attempt++) {
      try {
        this.etag = await this.backend.save(candidate, this.etag);
        break;
      } catch (e) {
        if (!(e instanceof ConflictError) || attempt >= 3) throw e;
        const remote = await this.backend.load(false);
        this.etag = remote.etag;
        candidate = mergeDocs(remote.doc ?? emptyDoc(), candidate);
      }
    }
    this.doc = candidate;
    this.cache();
  }
}

export async function loadConfig(): Promise<AppConfig> {
  try {
    const res = await fetch("./config.json", { cache: "no-cache" });
    const cfg = (await res.json()) as Partial<AppConfig>;
    return {
      clientId: (cfg.clientId || "").trim(),
      authority: cfg.authority || "https://login.microsoftonline.com/common",
    };
  } catch {
    return { clientId: "", authority: "https://login.microsoftonline.com/common" };
  }
}

export function createStore(host: Host, config: AppConfig): Store {
  const useOneDrive = host.inOutlook && host.naaSupported && !!config.clientId;
  const backend = useOneDrive
    ? new OneDriveBackend(createTokenProvider(config.clientId, config.authority))
    : new RoamingBackend(host);
  return new Store(backend, host);
}
