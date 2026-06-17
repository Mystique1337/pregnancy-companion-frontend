// Pushes .env.local into the linked Railway service (skips the dev-tunnel URLs so
// Railway's own domain is used). Run after `railway up` has created the service.
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const SKIP = new Set(["APP_URL", "PUBLIC_WEBHOOK_URL"]);
const env = readFileSync(".env.local", "utf8");
const args = ["variables"];
let count = 0;
for (const line of env.split("\n")) {
  const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
  if (!m) continue;
  const key = m[1];
  const val = m[2].replace(/^["']|["']$/g, "");
  if (SKIP.has(key) || !val) continue;
  args.push("--set", `${key}=${val}`);
  count++;
}
console.log(`Setting ${count} variables on Railway…`);
const r = spawnSync("railway", args, { stdio: "inherit" });
process.exit(r.status ?? 1);
