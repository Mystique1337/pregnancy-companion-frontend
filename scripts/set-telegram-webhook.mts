/**
 * Point the Telegram bot at a new deployment.
 *
 *   npx tsx scripts/set-telegram-webhook.mts                     # uses APP_URL from .env.local
 *   npx tsx scripts/set-telegram-webhook.mts https://your.domain # explicit base URL
 *   npx tsx scripts/set-telegram-webhook.mts --info              # just show current state
 *
 * The secret_token matters: app/api/telegram/webhook/route.ts rejects any update
 * whose x-telegram-bot-api-secret-token header does not match
 * TELEGRAM_WEBHOOK_SECRET. Registering the webhook without it makes Telegram
 * look correctly configured while every message is silently 401'd.
 */
import { readFileSync } from "node:fs";

for (const line of (() => { try { return readFileSync(".env.local", "utf8").split("\n"); } catch { return []; } })()) {
  const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
}

const TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const SECRET = process.env.TELEGRAM_WEBHOOK_SECRET || "";
if (!TOKEN) { console.error("TELEGRAM_BOT_TOKEN is not set"); process.exit(1); }

const args = process.argv.slice(2);
const infoOnly = args.includes("--info");
const base = (args.find((a) => a.startsWith("http")) || process.env.APP_URL || process.env.PUBLIC_WEBHOOK_URL || "").replace(/\/+$/, "");

const api = (m: string) => `https://api.telegram.org/bot${TOKEN}/${m}`;
const redact = (s: string) => s.replace(new RegExp(TOKEN.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"), "<TOKEN>");

async function call(method: string, body?: Record<string, unknown>) {
  const res = await fetch(api(method), {
    method: body ? "POST" : "GET",
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  return (await res.json()) as { ok: boolean; result?: unknown; description?: string };
}

async function show(label: string) {
  const info = (await call("getWebhookInfo")).result as Record<string, unknown> | undefined;
  console.log(`\n${label}`);
  if (!info) { console.log("  (no info)"); return; }
  for (const k of ["url", "pending_update_count", "last_error_date", "last_error_message", "max_connections"]) {
    if (info[k] === undefined) continue;
    const v = k === "last_error_date" ? new Date(Number(info[k]) * 1000).toISOString() : info[k];
    console.log(`  ${k.padEnd(22)} ${redact(String(v))}`);
  }
  console.log(`  ${"has_custom_certificate".padEnd(22)} ${info.has_custom_certificate}`);
  console.log(`  ${"secret token set".padEnd(22)} ${"secret_token" in info ? "yes" : "not reported by API"}`);
}

const me = await call("getMe");
console.log(`bot: @${(me.result as { username?: string } | undefined)?.username ?? "unknown"}  (ok: ${me.ok})`);
await show("current webhook:");

if (infoOnly) process.exit(0);
if (!base) { console.error("\nNo base URL. Pass one, or set APP_URL in .env.local."); process.exit(1); }
if (!/^https:\/\//.test(base)) { console.error("\nTelegram requires https."); process.exit(1); }

const url = `${base}/api/telegram/webhook`;
console.log(`\nsetting webhook -> ${url}`);
if (!SECRET) console.log("  WARNING: TELEGRAM_WEBHOOK_SECRET is empty, updates will not be authenticated");

const set = await call("setWebhook", {
  url,
  secret_token: SECRET || undefined,
  allowed_updates: ["message"],
  drop_pending_updates: true,
});
console.log(`  ${set.ok ? "ok" : "FAILED"}${set.description ? ": " + set.description : ""}`);
await show("now:");

// Prove the endpoint is actually reachable and rejecting unauthenticated posts.
const probe = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
console.log(`\nendpoint probe (no secret header): ${probe.status} ${probe.status === 401 || probe.status === 403 ? "(correctly rejected)" : ""}`);
