// THE DECISION-MAKER CHANNEL. In much of Nigeria the mother does not decide alone
// whether to go to hospital — a husband or mother-in-law does, and that delay kills.
// Male-partner involvement has a real evidence base for facility delivery, so Bumply
// speaks to the decision-maker too: the danger alert, the transport plan, and a short
// weekly "how to support her" nudge. Opt-in only, and never her private conversations.
import { sendWhatsApp, whatsappConfigured } from "./whatsapp";
import type { Mother } from "./queries";
import { logAudit } from "./queries";
import { currentWeekFrom } from "./babyData";

export function partnerEnabled(m: Mother): boolean {
  return !!(m.partner_opt_in && m.partner_phone && m.partner_phone.replace(/\D/g, "").length >= 7);
}

/** First contact with the partner — explains who we are and what he'll get. */
export function partnerWelcome(m: Mother): string {
  const first = (m.full_name || "she").split(" ")[0];
  return `Hello 👋 I'm Bumply, ${first}'s free pregnancy helper.\n\nShe asked me to keep you in the loop. I'll send you:\n• A warning immediately if she shows a danger sign\n• One short note each week on how to support her\n\nI never share her private messages. Reply STOP any time to opt out.`;
}

/** The alert that matters most: she is in danger, and you can act. */
export async function alertPartnerDanger(m: Mother, sign: string, mapsUrl?: string | null): Promise<boolean> {
  if (!partnerEnabled(m) || !whatsappConfigured()) return false;
  const first = (m.full_name || "She").split(" ")[0];
  const where = mapsUrl ? `\nHer location: ${mapsUrl}` : "";
  const msg = `🚨 ${first} has a pregnancy danger sign (${sign}).\n\nShe needs to reach a hospital NOW — please help her go, and go with her if you can. Do not wait until morning.${where}\n\n— Bumply`;
  const r = await sendWhatsApp(m.partner_phone!, msg).catch(() => ({ sent: false }));
  logAudit({ mother_id: m.id, actor: "system", action: "partner_alerted", summary: sign, meta: { sent: r.sent } });
  return r.sent === true;
}

const WEEKLY_ASKS = [
  "Ask her how she slept, and take one chore off her today.",
  "Go with her to her next clinic visit if you can — mothers whose partners come are more likely to deliver safely.",
  "Make sure there's money set aside for transport to the hospital, day or night.",
  "Help her eat well today: beans, eggs, fish, green vegetables. Iron matters.",
  "Check the plan: who carries her to hospital at 2am, and in whose vehicle?",
  "Ask if she's worried about anything. Listening is support.",
  "Remind her to take her iron and folic acid tablets.",
];

/** One short weekly nudge to the decision-maker — practical, never preachy. */
export async function partnerWeeklyNudge(m: Mother, seed: number): Promise<boolean> {
  if (!partnerEnabled(m) || !whatsappConfigured()) return false;
  const first = (m.full_name || "She").split(" ")[0];
  const week = currentWeekFrom({ dueDate: m.due_date, enteredWeek: m.current_week, createdAt: m.created_at });
  const ask = WEEKLY_ASKS[Math.abs(seed) % WEEKLY_ASKS.length];
  const msg = `👨🏾 ${first} is in week ${week}.\n\nThis week: ${ask}\n\n— Bumply (reply STOP to opt out)`;
  const r = await sendWhatsApp(m.partner_phone!, msg).catch(() => ({ sent: false }));
  return r.sent === true;
}

/** Partner texted STOP — honour it immediately. */
export function isPartnerOptOut(text: string): boolean {
  return /^\s*(stop|unsubscribe|opt\s*out|remove me)\b/i.test(text || "");
}
