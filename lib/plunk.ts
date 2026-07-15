// Plunk transactional email (open-source, self-hostable — useplunk.com).
// Works with Plunk cloud (PLUNK_URL=https://api.useplunk.com) or a self-hosted
// instance (PLUNK_URL=https://plunk.yourdomain.com). Uses the SECRET key.
const URL = (process.env.PLUNK_URL || "https://api.useplunk.com").replace(/\/+$/, "");
const KEY = process.env.PLUNK_API_KEY || process.env.PLUNK_SECRET_KEY || "";

export function plunkConfigured(): boolean {
  return !!KEY;
}

// Extract a bare email from an "EMAIL_FROM" that may be "Name <addr>".
function fromAddress(): string | undefined {
  const raw = process.env.EMAIL_FROM || "";
  const m = raw.match(/<([^>]+)>/);
  const addr = (m ? m[1] : raw).trim();
  return /@/.test(addr) ? addr : undefined;
}
function fromName(): string | undefined {
  const raw = process.env.EMAIL_FROM || "";
  const m = raw.match(/^\s*"?([^"<]+?)"?\s*</);
  return m ? m[1].trim() : undefined;
}

export async function sendViaPlunk(
  to: string,
  subject: string,
  html: string
): Promise<{ sent: boolean; skipped?: boolean; error?: string; id?: string }> {
  if (!KEY) return { sent: false, skipped: true };
  try {
    const body: Record<string, unknown> = { to, subject, body: html, subscribed: true };
    const from = fromAddress();
    if (from) body.from = from;
    const name = fromName();
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
