// DELAY 2 — "reaching care". In the Three Delays model, mothers die because the
// decision to seek care doesn't turn into arriving at a facility: no vehicle, no
// money, no plan at 2am. Software usually ignores this delay. Bumply captures the
// plan BEFORE the emergency and dispatches it in one tap.
import { sendWhatsApp, whatsappConfigured } from "./whatsapp";
import { sendTelegram } from "./telegram";
import type { Mother } from "./queries";
import { logAudit } from "./queries";

export function hasTransportPlan(m: Mother): boolean {
  return !!(m.transport_phone && m.transport_phone.replace(/\D/g, "").length >= 7);
}

/** Pull "Musa 08031234567" (any order, any punctuation) out of her reply. */
export function parseTransportReply(text: string): { name: string | null; phone: string } | null {
  const t = String(text || "").trim();
  const digits = t.replace(/[^\d+]/g, "");
  const phone = digits.replace(/\D/g, "");
  if (phone.length < 7) return null;
  // Whatever isn't the number is the name.
  const name = t.replace(/[\d+()\-\s]{7,}/g, " ").replace(/[^\p{L}\s'’-]/gu, " ").trim().split(/\s+/).slice(0, 3).join(" ");
  return { name: name || null, phone: digits.startsWith("+") ? digits : phone };
}

/**
 * Emergency dispatch: alert the rider/driver she named AND her partner, with her
 * location, in one action. Fails soft per-recipient — one bad number must never
 * stop the others.
 */
export async function dispatchTransport(
  mother: Mother,
  opts: { mapsUrl?: string | null; facility?: string | null } = {}
): Promise<{ rider: boolean; partner: boolean }> {
  const first = (mother.full_name || "A mother").split(" ")[0];
  const where = opts.mapsUrl ? `\nHer location: ${opts.mapsUrl}` : "";
  const to = opts.facility ? ` to ${opts.facility}` : " to the nearest hospital";
  const result = { rider: false, partner: false };

  if (hasTransportPlan(mother) && whatsappConfigured()) {
    const msg = `🚨 URGENT — ${first} needs to get${to} NOW. She saved your number as her emergency transport.${where}\n\nPlease call or go to her immediately. — Bumply`;
    const r = await sendWhatsApp(mother.transport_phone!, msg).catch(() => ({ sent: false }));
    result.rider = r.sent === true;
  }

  if (mother.partner_opt_in && mother.partner_phone && whatsappConfigured()) {
    const msg = `🚨 URGENT — ${first} has a pregnancy danger sign and needs to reach${to} NOW.${where}\n\nPlease help her get there immediately, and go with her if you can. — Bumply`;
    const r = await sendWhatsApp(mother.partner_phone, msg).catch(() => ({ sent: false }));
    result.partner = r.sent === true;
  }
  // Telegram-linked mothers may have no WhatsApp at all — tell her own chat too.
  if (!result.rider && !result.partner && mother.telegram_chat_id) {
    await sendTelegram(mother.telegram_chat_id, "I couldn't reach your transport contact automatically. Please call them now, or ask someone nearby to carry you.").catch(() => {});
  }

  logAudit({
    mother_id: mother.id, actor: "system", action: "transport_dispatched",
    summary: `rider=${result.rider} partner=${result.partner}`, meta: { ...opts },
  });
  return result;
}

/** The line appended to an emergency reply when she has a plan saved. */
export function transportLine(m: Mother): string {
  if (!hasTransportPlan(m)) {
    return "🚕 Do you have someone who can carry you now? If not, ask a neighbour — do not wait alone.";
  }
  return `🚕 I am alerting ${m.transport_name || "your transport contact"} (${m.transport_phone}) to carry you now.`;
}
