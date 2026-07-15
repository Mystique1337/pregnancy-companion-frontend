import { listAllMothers, setUpdateSent } from "./queries";
import { ensureWeeklyUpdate } from "./weekly";
import { currentWeekFrom } from "./babyData";
import { babyImageFor } from "./babyImages";
import { sendEmail, emailConfigured, readPublicImage, FROM } from "./email";
import { sendWhatsApp, whatsappConfigured } from "./whatsapp";
import { pushWeeklyReady } from "./notify";
import { publicBaseUrl } from "./baseUrl";

export type WeeklyJobResult = {
  ok: boolean;
  mothers: number;
  generated: number;
  emailed: number;
  whatsapped: number;
  errors: number;
  channels: { email: boolean; whatsapp: boolean };
};

/**
 * For every mother: compute her live week, ensure that week's update exists,
 * and deliver it by email + WhatsApp (each gated on env config; skipped cleanly if not set).
 */
export async function runWeeklyJob(): Promise<WeeklyJobResult> {
  const mothers = await listAllMothers();
  const base = process.env.APP_URL || "";
  let generated = 0,
    emailed = 0,
    whatsapped = 0,
    errors = 0;

  for (const m of mothers) {
    try {
      const week = currentWeekFrom({ dueDate: m.due_date, enteredWeek: m.current_week, createdAt: m.created_at });
      const update = await ensureWeeklyUpdate(m, week);
      generated++;

      // Push "your new week is ready" (deduped once per week).
      await pushWeeklyReady(m, week).catch(() => {});

      const link = base ? `${base}/my-update/${update.slug}` : "";

      if (!update.sent_email) {
        const img = babyImageFor(week);
        let html = update.html_content || "";
        let attachments;
        const pub = base || publicBaseUrl();
        if (pub && img.src.startsWith("/")) {
          // Prefer a hosted absolute URL — works with providers that drop attachments (Plunk).
          html = html.replace(`src="${img.src}"`, `src="${pub}${img.src}"`);
        } else {
          // No public URL (local dev) → embed the image inline via cid.
          try {
            const buf = await readPublicImage(img.file);
            html = html.replace(`src="${img.src}"`, `src="cid:babyhero"`);
            attachments = [{ filename: img.file, content: buf, contentId: "babyhero" }];
          } catch {
            // If the image can't be read, send without it rather than failing the email.
          }
        }
        const r = await sendEmail(m.email, update.subject || `Your week ${week} update 🌸`, html, attachments, FROM.updates);
        if (r.sent) {
          await setUpdateSent(update.id, "email");
          emailed++;
        }
      }

      const phone = m.whatsapp_number || m.phone;
      if (!update.sent_whatsapp && phone) {
        const r = await sendWhatsApp(phone, `Hi ${m.full_name} 🌸 Your week ${week} Bumply update is ready${link ? `: ${link}` : "."}`);
        if (r.sent) {
          await setUpdateSent(update.id, "whatsapp");
          whatsapped++;
        }
      }
    } catch (e) {
      console.error("weekly job error for", m.email, e);
      errors++;
    }
    // Anti-ban: space out WhatsApp sends so we don't blast a burst of identical messages.
    if (whatsappConfigured()) await new Promise((r) => setTimeout(r, 1500 + Math.floor(Math.random() * 2500)));
  }

  return {
    ok: true,
    mothers: mothers.length,
    generated,
    emailed,
    whatsapped,
    errors,
    channels: { email: emailConfigured(), whatsapp: whatsappConfigured() },
  };
}
