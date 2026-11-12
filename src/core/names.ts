export interface ParsedName {
  titel: string;
  vorname: string;
  nachname: string;
}

const TITLES = /^(prof\.?|dr\.?|dipl\.?-?[a-zäöü]*\.?|ing\.?|mag\.?|med\.?|jur\.?|rer\.?|nat\.?|h\.?c\.?|ra|rain)$/i;

function capitalize(s: string): string {
  return s
    .split("-")
    .map((p) => (p ? p[0].toUpperCase() + p.slice(1) : p))
    .join("-");
}

/**
 * Zerlegt einen Outlook-Anzeigenamen heuristisch in Titel, Vor- und Nachname.
 * Unterstützt "Vorname Nachname", "Nachname, Vorname", Titel und Zusätze in Klammern.
 * Ist kein brauchbarer Name vorhanden, wird er aus der E-Mail-Adresse abgeleitet.
 */
export function parseName(displayName: string, email = ""): ParsedName {
  let name = (displayName || "")
    .replace(/[([<].*?[)\]>]/g, " ") // Zusätze wie "(Firma)" oder "<adresse>"
    .replace(/["']/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!name || name.includes("@")) {
    const local = (name.includes("@") ? name : email).split("@")[0] || "";
    const parts = local.split(/[._]+/).filter((p) => p && !/^\d+$/.test(p));
    if (parts.length >= 2) {
      return {
        titel: "",
        vorname: capitalize(parts[0]),
        nachname: parts.slice(1).map(capitalize).join(" "),
      };
    }
    return { titel: "", vorname: "", nachname: "" };
  }

  if (name.includes(",")) {
    const [last, ...rest] = name.split(",");
    name = `${rest.join(" ").trim()} ${last.trim()}`.trim();
  }

  const words = name.split(" ");
  const titles: string[] = [];
  const others: string[] = [];
  for (const w of words) (TITLES.test(w) ? titles : others).push(w);

  if (others.length === 0) return { titel: titles.join(" "), vorname: "", nachname: "" };
  if (others.length === 1) return { titel: titles.join(" "), vorname: "", nachname: others[0] };

  // Namenszusätze wie "von", "van der", "de" gehören zum Nachnamen.
  let split = others.length - 1;
  while (split > 1 && /^(von|van|de|der|den|zu|zur|vom|del|della|di|da|le|la|ten|ter)$/i.test(others[split - 1])) {
    split--;
  }
  return {
    titel: titles.join(" "),
    vorname: others.slice(0, split).join(" "),
    nachname: others.slice(split).join(" "),
  };
}

export type SalutationForm = "frau" | "herr" | "gutenTag" | "hallo" | "liebe" | "lieber" | "neutral";

export const SALUTATION_FORMS: { id: SalutationForm; label: string }[] = [
  { id: "frau", label: "Sehr geehrte Frau …" },
  { id: "herr", label: "Sehr geehrter Herr …" },
  { id: "gutenTag", label: "Guten Tag Vorname Nachname" },
  { id: "hallo", label: "Hallo Vorname" },
  { id: "liebe", label: "Liebe Vorname" },
  { id: "lieber", label: "Lieber Vorname" },
  { id: "neutral", label: "Sehr geehrte Damen und Herren" },
];

const join = (...parts: string[]) => parts.filter(Boolean).join(" ");

/** Baut die Anredezeile ohne abschließendes Komma. */
export function buildSalutation(form: SalutationForm, n: ParsedName): string {
  const neutral = "Sehr geehrte Damen und Herren";
  switch (form) {
    case "frau":
      return n.nachname ? join("Sehr geehrte Frau", n.titel, n.nachname) : neutral;
    case "herr":
      return n.nachname ? join("Sehr geehrter Herr", n.titel, n.nachname) : neutral;
    case "gutenTag":
      return join("Guten Tag", n.titel, n.vorname, n.nachname);
    case "hallo":
      return join("Hallo", n.vorname || n.nachname);
    case "liebe":
      return join("Liebe", n.vorname || n.nachname);
    case "lieber":
      return join("Lieber", n.vorname || n.nachname);
    default:
      return neutral;
  }
}
