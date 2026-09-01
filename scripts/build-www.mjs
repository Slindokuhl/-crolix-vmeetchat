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

// Capacitor's global (no-bundler) runtime + plugin bundles, loaded via <script>
// tags in index.html — same pattern as the Agora/Firebase CDN scripts.
const vendorDir = path.join(outDir, "vendor", "capacitor");
mkdirSync(vendorDir, { recursive: true });
cpSync(
  path.join(root, "node_modules/@capacitor/core/dist/capacitor.js"),
  path.join(vendorDir, "capacitor.js")
);
cpSync(
  path.join(root, "node_modules/@capacitor/browser/dist/plugin.js"),
  path.join(vendorDir, "browser-plugin.js")
);

console.log(`Built www/ from: ${entries.join(", ")}, plus vendor/capacitor`);
