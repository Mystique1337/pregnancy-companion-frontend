// Plunk transactional email (open-source, self-hostable — useplunk.com).
// Works with Plunk cloud (PLUNK_URL=https://api.useplunk.com) or a self-hosted
// instance (PLUNK_URL=https://plunk.yourdomain.com). Uses the SECRET key.
const URL = (process.env.PLUNK_URL || "https://api.useplunk.com").replace(/\/+$/, "");
const KEY = process.env.PLUNK_API_KEY || process.env.PLUNK_SECRET_KEY || "";

export function plunkConfigured(): boolean {
  return !!KEY;
}

// Parse a "Name <addr>" (or bare addr) string into { addr, name }.
function parseFrom(raw?: string): { addr?: string; name?: string } {
  const s = (raw || process.env.EMAIL_FROM || "").trim();
  const m = s.match(/^\s*"?([^"<]+?)"?\s*<([^>]+)>\s*$/);
  if (m) return { name: m[1].trim(), addr: m[2].trim() };
  return /@/.test(s) ? { addr: s } : {};
}

export async function sendViaPlunk(
  to: string,
  subject: string,
  html: string,
  fromOverride?: string
): Promise<{ sent: boolean; skipped?: boolean; error?: string; id?: string }> {
  if (!KEY) return { sent: false, skipped: true };
  try {
    const body: Record<string, unknown> = { to, subject, body: html, subscribed: true };
    const { addr, name } = parseFrom(fromOverride);
    if (addr) body.from = addr;
    if (name) body.name = name;

    const res = await fetch(`${URL}/v1/send`, {
      method: "POST",
      headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    const text = await res.text();
    if (!res.ok) return { sent: false, error: `Plunk ${res.status}: ${text.slice(0, 200)}` };
    let id: string | undefined;
    try { const j = JSON.parse(text); id = j?.emails?.[0]?.contact || j?.id; } catch { /* ignore */ }
    return { sent: true, id };
  } catch (e) {
    return { sent: false, error: e instanceof Error ? e.message : "plunk send failed" };
  }
}
