/** Kapselt alle Zugriffe auf Outlook, damit die Oberfläche auch im Browser (Demo-Modus) läuft. */

export interface Person {
  name: string;
  email: string;
}

export interface Host {
  inOutlook: boolean;
  naaSupported: boolean;
  getSender(): Person;
  getRecipients(): Promise<Person[]>;
  getSubject(): Promise<string>;
  setSubject(subject: string): Promise<void>;
  insertHtml(html: string): Promise<void>;
  getBodyHtml(): Promise<string>;
  roamingGet(key: string): unknown;
  roamingSet(key: string, value: unknown): Promise<void>;
}

function promisify<T>(call: (cb: (r: Office.AsyncResult<T>) => void) => void): Promise<T> {
  return new Promise((resolve, reject) =>
    call((r) =>
      r.status === Office.AsyncResultStatus.Succeeded
        ? resolve(r.value)
        : reject(new Error(r.error?.message || "Outlook hat die Anfrage abgelehnt.")),
    ),
  );
}

function outlookHost(): Host {
  const mailbox = Office.context.mailbox;
  const item = () => {
    const i = mailbox.item as Office.MessageCompose | undefined;
    if (!i || !i.body?.setSelectedDataAsync) {
      throw new Error("Bitte öffnen Sie eine neue E-Mail oder Antwort.");
    }
    return i;
  };
  const settings = Office.context.roamingSettings;
  return {
    inOutlook: true,
    naaSupported: Office.context.requirements.isSetSupported("NestedAppAuth", "1.1"),
    getSender: () => ({
      name: mailbox.userProfile.displayName || "",
      email: mailbox.userProfile.emailAddress || "",
    }),
    getRecipients: async () => {
      const list = await promisify<Office.EmailAddressDetails[]>((cb) => item().to.getAsync(cb));
      return list.map((r) => ({ name: r.displayName || "", email: r.emailAddress || "" }));
    },
    getSubject: () => promisify<string>((cb) => item().subject.getAsync(cb)),
    setSubject: (s) => promisify<void>((cb) => item().subject.setAsync(s.slice(0, 255), cb)),
    insertHtml: (html) =>
      promisify<void>((cb) => item().body.setSelectedDataAsync(html, { coercionType: Office.CoercionType.Html }, cb)),
    getBodyHtml: () => promisify<string>((cb) => item().body.getAsync(Office.CoercionType.Html, cb)),
    roamingGet: (key) => settings.get(key),
    roamingSet: (key, value) => {
      if (value === undefined) settings.remove(key);
      else settings.set(key, value);
      return promisify<void>((cb) => settings.saveAsync(cb));
    },
  };
}

/** Ersatz außerhalb von Outlook: speichert im Browser und fügt nichts ein. */
function demoHost(): Host {
  const KEY = "vorlagen.demo.";
  return {
    inOutlook: false,
    naaSupported: false,
    getSender: () => ({ name: "Max Beispiel", email: "max.beispiel@example.com" }),
    getRecipients: async () => [{ name: "Müller, Erika", email: "erika.mueller@example.com" }],
    getSubject: async () => "",
    setSubject: async () => {},
    insertHtml: async (html) => {
      (window as unknown as { __inserted?: string }).__inserted = html;
    },
    getBodyHtml: async () => "<p>Beispieltext aus der <b>aktuellen E-Mail</b>.</p>",
    roamingGet: (key) => {
      try {
        const raw = localStorage.getItem(KEY + key);
        return raw ? JSON.parse(raw) : undefined;
      } catch {
        return undefined;
      }
    },
    roamingSet: async (key, value) => {
      if (value === undefined) localStorage.removeItem(KEY + key);
      else localStorage.setItem(KEY + key, JSON.stringify(value));
    },
  };
}

export function initHost(): Promise<Host> {
  if (typeof Office === "undefined") return Promise.resolve(demoHost());
  return new Promise((resolve) => {
    const fallback = setTimeout(() => resolve(demoHost()), 4000);
    Office.onReady((info) => {
      clearTimeout(fallback);
      resolve(info.host === Office.HostType.Outlook ? outlookHost() : demoHost());
    });
  });
}
