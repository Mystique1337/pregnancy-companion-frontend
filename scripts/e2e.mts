// End-to-end smoke test against the running app (PORT 8080). Signs up a throwaway
// mother, exercises every feature, checks admin + clinic, then cleans up.
import { readFileSync } from "node:fs";
const env = readFileSync(".env.local", "utf8");
for (const line of env.split("\n")) {
  const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const q = await import("../lib/queries.ts");

const BASE = "http://localhost:8080";
const ADMIN_PW = process.env.ADMIN_PASSWORD || "nerveadmin2026";

class Jar {
  cookies = new Map<string, string>();
  header() { return [...this.cookies].map(([k, v]) => `${k}=${v}`).join("; "); }
  absorb(res: Response) {
    const sc = (res.headers as unknown as { getSetCookie?: () => string[] }).getSetCookie?.() || [];
    for (const c of sc) { const p = c.split(";")[0]; const i = p.indexOf("="); if (i > 0) this.cookies.set(p.slice(0, i), p.slice(i + 1)); }
  }
}
async function req(jar: Jar | null, method: string, path: string, opts: { json?: unknown; body?: BodyInit; headers?: Record<string, string> } = {}) {
  const headers: Record<string, string> = { ...(jar ? { Cookie: jar.header() } : {}), ...(opts.headers || {}) };
  let body = opts.body;
  if (opts.json !== undefined) { headers["Content-Type"] = "application/json"; body = JSON.stringify(opts.json); }
  const res = await fetch(BASE + path, { method, redirect: "manual", headers, body });
  if (jar) jar.absorb(res);
  return res;
}

let pass = 0, fail = 0;
const fails: string[] = [];
function ok(name: string, cond: boolean, detail = "") {
  if (cond) { pass++; console.log("  ✓ " + name); }
  else { fail++; fails.push(name + (detail ? ` — ${detail}` : "")); console.log("  ✗ " + name + (detail ? ` — ${detail}` : "")); }
}

const stamp = Date.now();
const email = `e2e+${stamp}@test.bumply`;
const mom = new Jar();

console.log("\n— Public —");
ok("GET / 200", (await req(null, "GET", "/")).status === 200);
ok("GET /login 200", (await req(null, "GET", "/login")).status === 200);
ok("GET /pricing 200", (await req(null, "GET", "/pricing")).status === 200);
ok("protected /dashboard redirects when logged-out", (await req(null, "GET", "/dashboard")).status === 307);

console.log("\n— Signup + auth —");
const signup = await req(mom, "POST", "/api/auth/signup", { json: { email, password: "testpass123", full_name: "E2E Mama", due_date: "2026-09-01", current_week: 30, phone: "+2348100000000", language: "en" } });
ok("signup ok", signup.status === 200, `status ${signup.status}`);
const mother = await q.getMotherByEmail(email);
ok("mother row created", !!mother, "not found in DB");
const id = mother!.id;
ok("session works → /dashboard 200", (await req(mom, "GET", "/dashboard")).status === 200);

console.log("\n— Languages —");
await req(mom, "POST", "/api/lang", { json: { language: "yo" } });
const dashYo = await (await req(mom, "GET", "/dashboard")).text();
ok("dashboard renders Yoruba", /Báwo|Ọmọ rẹ|Ilé/.test(dashYo));
await req(mom, "POST", "/api/lang", { json: { language: "en" } });

console.log("\n— User customization (preferences) —");
ok("save preferences", (await req(mom, "POST", "/api/account/preferences", { json: { tone: "concise", focus: ["Nutrition & meals"], about: "I am a nurse expecting twins" } })).status === 200);
const acct = await (await req(mom, "GET", "/account")).text();
ok("account shows saved 'about'", acct.includes("I am a nurse expecting twins"));

console.log("\n— Core pages 200 —");
for (const p of ["/journal", "/tools", "/vitals", "/hospitals", "/library", "/appointments", "/account", "/chat"]) {
  ok(`GET ${p}`, (await req(mom, "GET", p)).status === 200);
}

console.log("\n— Journal + Tools —");
ok("journal save", (await req(mom, "POST", "/api/journal", { json: { mood: "okay", symptoms: ["Nausea"], note: "e2e" } })).status === 200);

console.log("\n— Vitals + Alerts —");
const bpHigh = await (await req(mom, "POST", "/api/vitals", { json: { kind: "bp", value: 150, value2: 95 } })).json();
ok("high BP raises warning alert", bpHigh?.alert?.level === "warning", JSON.stringify(bpHigh?.alert || null));
const bpNorm = await (await req(mom, "POST", "/api/vitals", { json: { kind: "bp", value: 118, value2: 76 } })).json();
ok("normal BP → no alert", !bpNorm?.alert);
const alerts = await q.listAlertsForMother(id);
ok("alert persisted in DB", alerts.length >= 1, `${alerts.length} alerts`);

console.log("\n— Pages re-render WITH data (Date-handling regressions) —");
for (const p of ["/journal", "/account", "/vitals"]) {
  ok(`GET ${p} (with data)`, (await req(mom, "GET", p)).status === 200);
}

console.log("\n— Doctor report —");
const report = await (await req(mom, "GET", "/report")).text();
ok("report page renders with patient name", report.includes("Pregnancy summary") && report.includes("E2E Mama"));

console.log("\n— RAG / Meili search —");
const search = await (await req(mom, "POST", "/api/search", { json: { q: "nausea" } })).json();
ok("library search returns hits", (search?.hits?.length || 0) > 0, `${search?.hits?.length} hits`);

console.log("\n— Hospital locator (OpenStreetMap) —");
const hosp = await (await req(mom, "POST", "/api/hospitals", { json: { place: "Yaba, Lagos, Nigeria" } })).json();
ok("hospitals found near Lagos", (hosp?.hospitals?.length || 0) > 0, `${hosp?.hospitals?.length}`);
ok("a delivery-recommended facility exists", (hosp?.hospitals || []).some((h: { deliveryRecommended: boolean }) => h.deliveryRecommended));

console.log("\n— Push —");
const key = await (await req(mom, "GET", "/api/push/key")).json();
ok("VAPID public key served", typeof key?.key === "string" && key.key.length > 20);

console.log("\n— Voice (live Modal) —");
const tts = await req(mom, "POST", "/api/tts", { json: { text: "Hello mama", voice: "en" } });
ok("TTS returns audio/wav", tts.status === 200 && (tts.headers.get("content-type") || "").includes("audio/wav"), `status ${tts.status}`);

console.log("\n— Chat: free gate then premium (RAG-grounded) —");
const freeChat = await (await req(mom, "POST", "/api/chat", { json: { messages: [{ role: "user", content: "hi" }] } })).text();
ok("free user gets premium upsell", /premium/i.test(freeChat));

console.log("\n— Admin —");
const admin = new Jar();
ok("admin login", (await req(admin, "POST", "/api/admin/login", { json: { password: ADMIN_PW } })).status === 200);
for (const p of ["/admin", "/admin/users", "/admin/notifications", "/admin/clinicians", "/admin/settings", "/admin/whatsapp"]) {
  ok(`admin GET ${p}`, (await req(admin, "GET", p)).status === 200);
}
ok("admin set mother → premium", (await req(admin, "POST", "/api/admin/user", { json: { id, action: "plan", plan: "premium" } })).status === 200);

console.log("\n— Premium chat (streamed, RAG-grounded) —");
const premChat = await (await req(mom, "POST", "/api/chat", { json: { messages: [{ role: "user", content: "I keep vomiting in the morning, what can help?" }] } })).text();
ok("premium chat returns a grounded answer", premChat.trim().length > 20 && !/premium/i.test(premChat.slice(0, 40)), `len ${premChat.trim().length}`);

console.log("\n— Clinic portal —");
const clin = new Jar();
const clinLogin = await req(clin, "POST", "/api/clinic/login", { json: { email: "ada@clinic.test", password: "clinic12345" } });
ok("clinician login", clinLogin.status === 200, `status ${clinLogin.status}`);
ok("clinic portal 200", (await req(clin, "GET", "/clinic")).status === 200);

console.log("\n— Cleanup —");
await q.deleteMother(id);
ok("test mother deleted", !(await q.getMotherByEmail(email)));

console.log(`\n=========== ${pass} passed · ${fail} failed ===========`);
if (fails.length) console.log("FAILURES:\n - " + fails.join("\n - "));
process.exit(fail ? 1 : 0);
