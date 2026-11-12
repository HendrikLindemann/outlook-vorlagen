import { defineConfig } from "vite";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

// Entwicklerzertifikat aus "npm run certs" (office-addin-dev-certs), falls vorhanden.
const certDir = join(homedir(), ".office-addin-dev-certs");
const https = existsSync(join(certDir, "localhost.key"))
  ? {
      key: readFileSync(join(certDir, "localhost.key")),
      cert: readFileSync(join(certDir, "localhost.crt")),
      ca: readFileSync(join(certDir, "ca.crt")),
    }
  : undefined;

export default defineConfig({
  base: "./",
  server: { port: 3000, strictPort: true, https },
  preview: { port: 3000, strictPort: true, https },
  build: { target: "es2020" },
});
