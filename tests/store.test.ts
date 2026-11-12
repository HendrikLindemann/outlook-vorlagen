import { afterEach, describe, expect, it, vi } from "vitest";
import { DataDoc, emptyDoc, Template } from "../src/core/model";
import type { Host } from "../src/host";
import { Backend, ConflictError, OneDriveBackend, ROAMING_KEY } from "../src/storage/backends";
import { Store } from "../src/storage/store";

const tpl = (id: string, name = id): Template => ({
  id, name, category: "", subject: "", html: "<p>x</p>", modified: new Date().toISOString(),
});

function fakeHost(roaming: Record<string, unknown> = {}): Host {
  return {
    roamingGet: (k: string) => roaming[k],
    roamingSet: async (k: string, v: unknown) => {
      if (v === undefined) delete roaming[k];
      else roaming[k] = v;
    },
  } as unknown as Host;
}

/** Simuliert einen Speicher mit Versionsprüfung wie OneDrive. */
class FakeRemote implements Backend {
  kind = "onedrive" as const;
  doc: DataDoc | null = null;
  version = 0;
  async load() {
    return { doc: this.doc && (JSON.parse(JSON.stringify(this.doc)) as DataDoc), etag: this.doc ? String(this.version) : undefined };
  }
  async save(doc: DataDoc, etag: string | undefined) {
    if (this.doc && etag !== String(this.version)) throw new ConflictError();
    this.doc = JSON.parse(JSON.stringify(doc));
    return String(++this.version);
  }
}

describe("Store", () => {
  it("führt gleichzeitige Änderungen zweier Geräte zusammen", async () => {
    const remote = new FakeRemote();
    const a = new Store(remote, fakeHost());
    const b = new Store(remote, fakeHost());
    await a.load();
    await b.load();
    await a.mutate((d) => d.templates.push(tpl("von-a")));
    await b.mutate((d) => d.templates.push(tpl("von-b"))); // veralteter Stand, löst Konflikt aus
    expect(remote.doc!.templates.map((t) => t.id).sort()).toEqual(["von-a", "von-b"]);
    expect(b.doc.templates).toHaveLength(2);
  });

  it("übernimmt Vorlagen aus dem Postfach nach der OneDrive-Einrichtung", async () => {
    const roaming: Record<string, unknown> = { [ROAMING_KEY]: { ...emptyDoc(), templates: [tpl("alt")] } };
    const remote = new FakeRemote();
    const store = new Store(remote, fakeHost(roaming));
    await store.load();
    expect(remote.doc!.templates.map((t) => t.id)).toEqual(["alt"]);
    expect(roaming[ROAMING_KEY]).toBeUndefined();
  });
});

describe("OneDriveBackend", () => {
  afterEach(() => vi.unstubAllGlobals());
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

  it("lädt über die Download-Adresse und speichert mit If-Match", async () => {
    const calls: { url: string; init?: RequestInit }[] = [];
    vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
      calls.push({ url, init });
      if (url === "https://download.example/file") return json({ version: 1, templates: [tpl("1")], salutations: {} });
      if (init?.method === "PUT") return json({ eTag: "v2" });
      return json({ eTag: "v1", "@microsoft.graph.downloadUrl": "https://download.example/file" });
    });
    const backend = new OneDriveBackend(async () => "TOKEN");
    const loaded = await backend.load(false);
    expect(loaded.etag).toBe("v1");
    expect(loaded.doc!.templates).toHaveLength(1);
    expect(calls[1].init).toBeUndefined(); // Download ohne Authorization-Header

    expect(await backend.save(loaded.doc!, loaded.etag)).toBe("v2");
    const put = calls[2];
    expect(put.url).toMatch(/approot:\/vorlagen\.json:\/content$/);
    expect(put.init!.headers).toMatchObject({ Authorization: "Bearer TOKEN", "If-Match": "v1" });
  });

  it("meldet eine fehlende Datei als leer und 412 als Konflikt", async () => {
    vi.stubGlobal("fetch", async (_url: string, init?: RequestInit) =>
      init?.method === "PUT" ? json({}, 412) : json({}, 404),
    );
    const backend = new OneDriveBackend(async () => "TOKEN");
    expect((await backend.load(false)).doc).toBeNull();
    await expect(backend.save(emptyDoc(), "v1")).rejects.toBeInstanceOf(ConflictError);
  });
});
