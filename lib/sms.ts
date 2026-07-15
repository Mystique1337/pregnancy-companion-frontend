// SMS via BulkSMS Nigeria (bulksmsnigeria.com). Used for guaranteed-delivery
// reminders/alerts and phone-OTP login — reaches a mother even with no data / no
// WhatsApp. Set BULKSMS_TOKEN to enable; BULKSMS_SANDBOX=true tests without cost.
const TOKEN = process.env.BULKSMS_TOKEN || "";
const SENDER = (process.env.BULKSMS_SENDER || "Bumply").slice(0, 11); // Sender ID max 11 chars
const BASE = process.env.BULKSMS_SANDBOX === "true"
  ? "https://www.bulksmsnigeria.com/api/sandbox/v2"
  : "https://www.bulksmsnigeria.com/api/v2";

export function smsConfigured(): boolean {
  return !!TOKEN;
}

// Nigerian numbers → 234XXXXXXXXXX (no +, no leading 0). Accepts 080…, +234…, 234….
export function normalizeMsisdn(raw: string): string {
  let d = String(raw || "").replace(/\D/g, "");
  if (d.startsWith("0")) d = "234" + d.slice(1);
  else if (d.length === 10) d = "234" + d; // bare 10-digit
  return d;
}

export async function sendSms(to: string, body: string): Promise<{ sent: boolean; skipped?: boolean; error?: string; id?: string }> {
  if (!TOKEN) return { sent: false, skipped: true };
  const number = normalizeMsisdn(to);
  if (!number || number.length < 11) return { sent: false, error: "invalid number" };
  try {
    const res = await fetch(`${BASE}/sms`, {
      method: "POST",
      headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ from: SENDER, to: number, body: body.slice(0, 918) }),
      cache: "no-store",
      signal: AbortSignal.timeout(20000),
    });
    const data = await res.json().catch(() => ({}));
    if (data?.status === "success") return { sent: true, id: data?.data?.message_id };
    return { sent: false, error: data?.error?.message || data?.message || `HTTP ${res.status}` };
  } catch (e) {
    return { sent: false, error: e instanceof Error ? e.message : "sms failed" };
  }
}

export async function smsBalance(): Promise<{ ok: boolean; balance?: number; formatted?: string; error?: string }> {
  if (!TOKEN) return { ok: false, error: "not configured" };
  try {
    const res = await fetch(`${BASE}/balance`, { headers: { Authorization: `Bearer ${TOKEN}`, Accept: "application/json" }, signal: AbortSignal.timeout(15000) });
    const d = await res.json().catch(() => ({}));
    return d?.status === "success" ? { ok: true, balance: d.data?.balance, formatted: d.data?.formatted } : { ok: false, error: d?.message };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "failed" };
  }
}
