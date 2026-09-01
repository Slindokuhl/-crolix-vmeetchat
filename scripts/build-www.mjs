/**
 * scripts/build-www.mjs
 * Copies the static web app into www/, the Capacitor webDir.
 * No bundler needed — the app is plain ESM served as-is.
 */
import { cpSync, rmSync, existsSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const outDir = path.join(root, "www");

if (existsSync(outDir)) rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

const entries = ["index.html", "main.js", "src", "styles", "assets"];
for (const entry of entries) {
  cpSync(path.join(root, entry), path.join(outDir, entry), { recursive: true });
}

console.log(`Built www/ from: ${entries.join(", ")}`);
