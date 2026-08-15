/**
 * Reset the shared demo account to a clean, curated state.
 *
 *   npx tsx scripts/reset-demo.mts          # wipe her activity, keep the account
 *   npx tsx scripts/reset-demo.mts --purge  # delete the account entirely
 *
 * The demo account is public and writable by anyone who opens /demo, so run
 * this before an event. Otherwise a judge may open it and find whatever the
 * last visitor typed.
 */
import { readFileSync } from "node:fs";

for (const line of (() => { try { return readFileSync(".env.local", "utf8").split("\n"); } catch { return []; } })()) {
  const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
}

const { sql } = await import("../lib/db");
const { getMotherByEmail, deleteMother } = await import("../lib/queries");
const { ensureDemoMother, DEMO_EMAIL, DEMO_PASSWORD } = await import("../lib/demoAccount");

const purge = process.argv.includes("--purge");

const existing = await getMotherByEmail(DEMO_EMAIL);
if (existing && purge) {
  await deleteMother(existing.id);
  console.log(`purged ${DEMO_EMAIL}`);
  process.exit(0);
}

if (existing) {
  // Clear anything a visitor could have written, but keep the account so the
  // /demo link and any saved session still work.
  const id = existing.id;
  // Written out rather than looped: the REST bridge does not take dynamic
  // identifiers, and table names must never be interpolated anyway.
  const wipes: Array<[string, Promise<unknown>]> = [
    ["chat_messages", sql`delete from chat_messages where mother_id = ${id}`],
    ["journal_entries", sql`delete from journal_entries where mother_id = ${id}`],
    ["kick_sessions", sql`delete from kick_sessions where mother_id = ${id}`],
    ["vitals", sql`delete from vitals where mother_id = ${id}`],
    ["bump_photos", sql`delete from bump_photos where mother_id = ${id}`],
    ["alerts", sql`delete from alerts where mother_id = ${id}`],
    ["misinfo_checks", sql`delete from misinfo_checks where mother_id = ${id}`],
    ["ai_feedback", sql`delete from ai_feedback where mother_id = ${id}`],
    ["notification_log", sql`delete from notification_log where mother_id = ${id}`],
    ["audit_log", sql`delete from audit_log where mother_id = ${id}`],
  ];
  for (const [name, p] of wipes) {
    try { await p; } catch { console.log(`  (skipped ${name})`); }
  }
  console.log(`cleared activity for ${DEMO_EMAIL}`);
}

const mother = await ensureDemoMother();
console.log(`\ndemo account ready`);
console.log(`  name    ${mother.full_name}, week ${mother.current_week}`);
console.log(`  email   ${DEMO_EMAIL}`);
console.log(`  pass    ${DEMO_PASSWORD}`);
console.log(`  link    ${(process.env.APP_URL || "").replace(/\/+$/, "")}/demo`);
process.exit(0);
