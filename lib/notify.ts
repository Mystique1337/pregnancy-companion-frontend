import {
  listAllMothers,
  alreadyNotified,
  markNotified,
  listVitals,
  listJournalEntries,
  createAlert,
  type Mother,
} from "./queries";
import { assessRisk, type RiskReport } from "./risk";
import { currentWeekFrom } from "./babyData";
import { sendPushToMother } from "./push";
import { ancAtWeek } from "./anc";
import { milestoneAtWeek, type Milestone } from "./milestones";
import { dailyTipFor } from "./dailyTips";
import { sendEmail, emailConfigured, FROM } from "./email";
import { sendWhatsApp, whatsappConfigured } from "./whatsapp";
import { sendTelegram } from "./telegram";

function firstName(m: Mother): string {
  return (m.full_name || "mama").split(" ")[0];
}

// Send to the mom's linked Telegram, if any.
async function tgNotify(m: Mother, text: string): Promise<boolean> {
  if (!m.telegram_chat_id) return false;
  const r = await sendTelegram(m.telegram_chat_id, text).catch(() => ({ sent: false }));
  return !!r.sent;
}

/** Push "your week N update is ready" once per (mother, week). */
export async function pushWeeklyReady(mother: Mother, week: number): Promise<boolean> {
  const ref = `week-${week}`;
  if (await alreadyNotified(mother.id, "weekly", ref)) return false;
  const n = await sendPushToMother(mother.id, {
    title: `Your week ${week} update is ready 🌸`,
    body: `${firstName(mother)}, tap to see how your baby is growing this week.`,
    url: "/dashboard",
    tag: "weekly",
  });
  await tgNotify(mother, `🌸 ${firstName(mother)}, your week ${week} Bumply update is ready! Open the app to see how your baby is growing this week.`);
  await markNotified(mother.id, "weekly", ref);
  return n > 0;
}

function milestoneEmailHtml(mother: Mother, ms: Milestone): string {
  return `<!DOCTYPE html><html><body style="margin:0;background:#FBF7F1;font-family:'DM Sans',system-ui,Arial,sans-serif;color:#2E2620;line-height:1.7">
  <div style="max-width:520px;margin:0 auto;padding:32px 20px">
    <div style="background:linear-gradient(135deg,#F6E9E1,#EDF1E7);border-radius:24px;padding:36px 28px;text-align:center">
      <h1 style="font-family:Georgia,serif;font-weight:400;font-size:28px;margin:0 0 10px">${ms.title}</h1>
      <p style="margin:0;color:#5B4A3E">${firstName(mother)}, ${ms.body}</p>
    </div>
    <p style="text-align:center;color:#9A8576;font-size:12px;margin-top:18px">With love, Bumply 🌸</p>
  </div></body></html>`;
}

// Fan a health alert out to every channel the mother has (push + email + WhatsApp).
export async function sendAlert(mother: Mother, alert: { level: string; message: string }): Promise<void> {
  const urgent = alert.level === "urgent";
  const title = urgent ? "🚨 Bumply health alert" : "⚠️ Bumply health check";
  await sendPushToMother(mother.id, { title, body: alert.message, url: "/vitals", tag: "alert" }).catch(() => {});
  if (emailConfigured()) {
    const html = `<!DOCTYPE html><html><body style="margin:0;background:#FBF7F1;font-family:'DM Sans',system-ui,Arial,sans-serif;color:#2E2620;line-height:1.7">
      <div style="max-width:520px;margin:0 auto;padding:32px 20px">
        <div style="background:${urgent ? "#FBE3DC" : "#FBF1DC"};border:1px solid ${urgent ? "#C97B5A" : "#E8B96F"};border-radius:20px;padding:28px;text-align:center">
          <h1 style="font-family:Georgia,serif;font-weight:400;font-size:24px;margin:0 0 10px">${title}</h1>
          <p style="margin:0;color:#5B4A3E">${firstName(mother)}, ${alert.message}</p>
        </div>
        <p style="text-align:center;color:#9A8576;font-size:12px;margin-top:18px">This is information, not a diagnosis. With love, Bumply 🌸</p>
      </div></body></html>`;
    await sendEmail(mother.email, title, html, undefined, FROM.care).catch(() => {});
  }
  const phone = mother.whatsapp_number || mother.phone;
  if (whatsappConfigured() && phone) {
    await sendWhatsApp(phone, `${title}\n\n${firstName(mother)}, ${alert.message}`).catch(() => {});
  }
  await tgNotify(mother, `${title}\n\n${firstName(mother)}, ${alert.message}`);
}

/** Days since epoch — used to rotate the daily tip deterministically per date. */
function daySeed(dateStr: string): number {
  const ms = Date.parse(dateStr + "T00:00:00Z");
  return Number.isNaN(ms) ? 0 : Math.floor(ms / 86400000);
}

export type DailyResult = { mothers: number; anc: number; milestone: number; daily: number; proactive: number };

/**
 * Daily engagement pass: ANC reminders + milestone celebrations + a daily tip,
 * each fired once via the notification_log de-dupe. `dateStr` = 'YYYY-MM-DD'.
 */
export async function runDailyEngagement(dateStr: string): Promise<DailyResult> {
  const mothers = await listAllMothers();
  let anc = 0,
    milestone = 0,
    daily = 0,
    proactive = 0;

  for (const m of mothers) {
    const week = currentWeekFrom({ dueDate: m.due_date, enteredWeek: m.current_week, createdAt: m.created_at });

    // 1) ANC visit reminders for this week
    for (const item of ancAtWeek(week)) {
      const ref = `anc-${item.week}`;
      if (await alreadyNotified(m.id, "anc", ref)) continue;
      await sendPushToMother(m.id, { title: `🗓 ${item.title}`, body: item.detail, url: "/appointments", tag: ref });
      await tgNotify(m, `🗓 ${item.title}\n${item.detail}`);
      await markNotified(m.id, "anc", ref);
      anc++;
    }

    // 2) Milestone celebration (push + email)
    const ms = milestoneAtWeek(week);
    if (ms) {
      const ref = `milestone-${ms.week}`;
      if (!(await alreadyNotified(m.id, "milestone", ref))) {
        await sendPushToMother(m.id, { title: ms.title, body: ms.body, url: "/dashboard", tag: ref });
        if (emailConfigured()) {
          await sendEmail(m.email, ms.title, milestoneEmailHtml(m, ms), undefined, FROM.updates).catch(() => {});
        }
        await tgNotify(m, `${ms.title}\n${firstName(m)}, ${ms.body}`);
        await markNotified(m.id, "milestone", ref);
        milestone++;
      }
    }

    // 3) Daily tip / check-in nudge
    const dref = `daily-${dateStr}`;
    if (!(await alreadyNotified(m.id, "daily", dref))) {
      const tip = dailyTipFor(week, daySeed(dateStr));
      const n = await sendPushToMother(m.id, { title: "Bumply tip 🌿", body: tip, url: "/dashboard", tag: "daily" });
      const tg = await tgNotify(m, `🌿 Bumply tip: ${tip}`);
      await markNotified(m.id, "daily", dref);
      if (n > 0 || tg) daily++;
    }

    // 4) Proactive risk watch — predict from her own data and reach out FIRST
    if (await runProactiveRiskCheck(m, week)) proactive++;
  }

  return { mothers: mothers.length, anc, milestone, daily, proactive };
}

/**
 * The proactive agent: screens a mother's recent vitals + journal for rising
 * risk and, when elevated/high (and not already flagged this week), gently
 * reaches out to her AND raises an alert for the clinician. Returns true if it
 * acted. Deduped per (mother, week, top-condition) so it nudges once, not daily.
 */
export async function runProactiveRiskCheck(m: Mother, week: number): Promise<boolean> {
  let report: RiskReport;
  try {
    const [vitals, journal] = await Promise.all([listVitals(m.id, undefined, 60), listJournalEntries(m.id, 20)]);
    if (vitals.length === 0 && journal.length === 0) return false;
    report = assessRisk({ week, firstPregnancy: !!m.first_pregnancy, vitals, journal });
  } catch {
    return false;
  }
  if (report.overall !== "elevated" && report.overall !== "high") return false;

  const top = report.assessments
    .filter((a) => a.level === "elevated" || a.level === "high")
    .sort((a, b) => b.score - a.score)[0];
  if (!top) return false;

  const ref = `risk-${week}-${top.condition}`;
  if (await alreadyNotified(m.id, "proactive", ref)) return false;

  const drivers = top.factors.slice(0, 2).join("; ");
  const message = `${firstName(m)}, I've been keeping an eye on your readings${drivers ? ` and noticed ${drivers.toLowerCase()}` : ""}. ${top.advice}`;

  await sendPushToMother(m.id, { title: `💛 A gentle check-in about your health`, body: message, url: "/vitals", tag: ref }).catch(() => {});
  await tgNotify(m, `💛 ${message}`);
  if (emailConfigured()) {
    const html = `<!DOCTYPE html><html><body style="margin:0;background:#FBF7F1;font-family:'DM Sans',system-ui,Arial,sans-serif;color:#2E2620;line-height:1.7"><div style="max-width:520px;margin:0 auto;padding:32px 20px"><div style="background:#FBF1DC;border:1px solid #E8B96F;border-radius:20px;padding:28px;text-align:center"><h1 style="font-family:Georgia,serif;font-weight:400;font-size:22px;margin:0 0 10px">💛 A gentle check-in</h1><p style="margin:0;color:#5B4A3E">${message}</p></div><p style="text-align:center;color:#9A8576;font-size:12px;margin-top:18px">A screening aid from your own logged data, not a diagnosis. With love, Bumply 🌸</p></div></body></html>`;
    await sendEmail(m.email, "💛 A gentle check-in about your health", html, undefined, FROM.care).catch(() => {});
  }
  // Raise an alert so a clinician reviews it (human-in-the-loop).
  await createAlert(m.id, {
    level: report.overall === "high" ? "urgent" : "warning",
    kind: `risk:${top.condition}`,
    message: `Proactive risk watch — ${top.label} flagged ${top.level}${drivers ? ` (${drivers})` : ""}.`,
  }).catch(() => {});

  await markNotified(m.id, "proactive", ref);
  return true;
}
