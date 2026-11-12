// Erzeugt das Manifest aus manifest.template.xml.
// Aufruf: node scripts/manifest.mjs [Basisadresse] [Zieldatei]
// Ohne Argumente gilt die Umgebungsvariable ADDIN_BASE_URL, sonst https://localhost:3000.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const dev = "https://localhost:3000";
const base = (process.argv[2] || process.env.ADDIN_BASE_URL || dev).replace(/\/+$/, "");
const out = process.argv[3] || (process.argv[2] ? "manifest.dev.xml" : "dist/manifest.xml");

if (!/^https:\/\//.test(base)) {
  console.error(`Die Basisadresse muss mit https:// beginnen: ${base}`);
  process.exit(1);
}
const xml = readFileSync("manifest.template.xml", "utf8").replaceAll("{{BASE_URL}}", base);
mkdirSync(dirname(out) || ".", { recursive: true });
writeFileSync(out, xml);
console.log(`Manifest geschrieben: ${out} (Basisadresse ${base})`);
if (base === dev && out.startsWith("dist")) {
  console.log("Hinweis: Für die Veröffentlichung ADDIN_BASE_URL auf die Hosting-Adresse setzen.");
}
