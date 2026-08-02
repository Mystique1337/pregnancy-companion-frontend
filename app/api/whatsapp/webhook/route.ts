import { NextResponse, after } from "next/server";
import { getMotherByPhone, createAlert } from "@/lib/queries";
import { getSettings } from "@/lib/settings";
import { bumplyReply } from "@/lib/companion";
import { sendText, sendWhatsAppAudio, downloadWhatsAppMedia, webhookSecret } from "@/lib/evolution";
import { detectDangerSign, dangerReply } from "@/lib/dangerSigns";
import { handleOnboarding, whatsappChannel } from "@/lib/waOnboard";
import { detectBirthAnnouncement, birthCongratsReply } from "@/lib/postpartum";
import { markDelivered } from "@/lib/queries";
import { immunizationReminder } from "@/lib/immunization";
import { readImage, safetyNote, visionConfigured } from "@/lib/vision";
import { detectLanguageChange, isLanguageMenuRequest, LANG_CONFIRM, LANG_MENU } from "@/lib/langSwitch";
import { updateMotherLanguage, setAlertReferral, recordConsent, eraseMotherData, logAudit, logMisinfoCheck } from "@/lib/queries";
import { CONSENT_VERSION, consentMessage, isConsentAccepted, isDeleteRequest, isDeleteConfirmed, DELETE_CONFIRM_MESSAGE, DELETE_DONE_MESSAGE } from "@/lib/consent";
import { handleProfileStep, beginProfileFlow, isProfileSetupRequest } from "@/lib/profileFlow";
import { checkClaim, looksLikeForwardedClaim, isFactCheckRequest } from "@/lib/misinfo";
import { newReferralCode, referralLine } from "@/lib/referral";
import { dispatchTransport, transportLine } from "@/lib/transport";
import { alertPartnerDanger } from "@/lib/partner";
import { transcribe, speak, normalizeVoice, warm } from "@/lib/voice";
import { wavToMp3 } from "@/lib/audio";

export const dynamic = "force-dynamic";
export const maxDuration = 120; // give the AI round-trip + delayed send room to finish in after()

// Evolution can verify the URL with a GET.
export async function GET() {
  return NextResponse.json({ ok: true });
}

type WAMessage = {
  conversation?: string;
  extendedTextMessage?: { text?: string };
  ephemeralMessage?: { message?: WAMessage };
};

function extractText(msg: WAMessage | undefined): string {
  if (!msg) return "";
  return (
    msg.conversation ||
    msg.extendedTextMessage?.text ||
    msg.ephemeralMessage?.message?.extendedTextMessage?.text ||
    ""
  ).trim();
}

export async function POST(req: Request) {
  // Shared-secret guard so only our Evolution instance can post here.
  const url = new URL(req.url);
  const secret = webhookSecret();
  if (secret && url.searchParams.get("secret") !== secret) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const event = String(body.event || body.type || "");
  if (event && !/messages[._]upsert/i.test(event)) {
    return NextResponse.json({ ok: true, ignored: event });
  }

  const raw = body.data;
  const entries = Array.isArray(raw) ? raw : raw ? [raw] : [];

  // Acknowledge fast; do the AI round-trip + reply after responding.
  after(async () => {
    for (const d of entries) {
      try {
        const key = d?.key || {};
        if (key.fromMe) continue; // ignore our own messages
        const jid = String(key.remoteJid || "");
        if (!jid || jid.endsWith("@g.us") || jid === "status@broadcast") continue; // skip groups/status

        // Resolve the message — transcribe voice notes with Whisper.
        let text = extractText(d?.message);
        let viaVoice = false;
        const audioMsg = d?.message?.audioMessage || d?.message?.ephemeralMessage?.message?.audioMessage;
        if (!text && audioMsg) {
          // Modal voice scales to zero — warm BOTH engines now so the TTS reply
          // isn't a second cold start after transcribe + the brain (~25s each).
          void warm().catch(() => {});
          try {
            const audio = await downloadWhatsAppMedia(d);
            if (audio) { text = (await transcribe(audio, "voice.ogg")).trim(); viaVoice = true; }
          } catch (e) { console.error("wa voice transcribe error:", e); }
        }
        const imageMsg = d?.message?.imageMessage || d?.message?.ephemeralMessage?.message?.imageMessage;
        if (!text && !imageMsg) continue;

        const phone = jid.split("@")[0].replace(/\D/g, "");
        const mother = await getMotherByPhone(phone);

        const settings = await getSettings();
        if (!settings.chat_enabled) continue;

        // Unknown number → self-onboarding over WhatsApp (no app, no signup form).
        // She joins Bumply just by messaging: we ask name + weeks, then create her.
        if (!mother) {
          // A photo alone can't drive onboarding — nudge her to say hi with text.
          if (!text && imageMsg) { await sendText(phone, "Hi 🌸 Welcome to Bumply! Send me a message (like *hi*) to get started, and I can also read your ANC card or medicine once you've joined."); continue; }
          // Safety first: a danger sign from anyone gets immediate guidance.
          const dNew = detectDangerSign(text);
          if (dNew) {
            await sendText(phone, dangerReply("mama", dNew));
            console.log(`[wa] DANGER (${dNew.sign}) from unregistered ${phone}`);
            continue;
          }
          const res = await handleOnboarding(text, whatsappChannel(phone));
          if (res.kind !== "skip") await sendText(phone, res.text);
          if (res.kind === "done") {
            // She's enrolled — NOW ask the three high-value questions. Enrolling first
            // means abandoning this flow costs us nothing.
            await recordConsent(res.mother.id, CONSENT_VERSION).catch(() => {});
            await sendText(phone, await beginProfileFlow(phone));
          }
          console.log(`[wa] onboarding ${res.kind} for ${phone}`);
          continue;
        }

        // If she spoke, reply with a voice note too (in her language).
        const voiceBack = async (msg: string) => {
          if (!viaVoice) return;
          try {
            const wav = await speak(msg.slice(0, 600), normalizeVoice(mother.language));
            await sendWhatsAppAudio(phone, await wavToMp3(wav));
          } catch (e) { console.error("wa voice reply error:", e); }
        };

        if (process.env.WHATSAPP_CHAT_REQUIRES_PREMIUM === "true" && mother.plan !== "premium") {
          const first = mother.full_name.split(" ")[0];
          const link = process.env.APP_URL ? ` ${process.env.APP_URL}/pricing` : "";
          await sendText(phone, `Hi ${first} 🌸 One-on-one chat with me is a premium feature. Upgrade in your Bumply dashboard and I'll be here any time, day or night!${link}`);
          continue;
        }

        // Photo understanding: she sent an image (ANC card, drug, test result).
        // Read it with the small VLM and explain it simply. Runs before text logic.
        if (imageMsg && !text) {
          const first = mother.full_name.split(" ")[0];
          if (!visionConfigured()) {
            await sendText(phone, `${first}, I can't read photos just yet 🌸 Please type your question and I'll help.`);
            continue;
          }
          await sendText(phone, "📷 Let me look at that for you…");
          try {
            const img = await downloadWhatsAppMedia(d);
            const caption = String((imageMsg as { caption?: string })?.caption || "").trim();
            const prompt = caption
              ? `A pregnant or new mother sent this photo and asks: "${caption}". Read the photo and answer her simply and kindly in plain English. If anything looks worrying, tell her to see a health worker. Do not diagnose.`
              : undefined;
            const read = img ? await readImage(img, prompt) : null;
            const flag = read ? await safetyNote(read) : "";
            await sendText(phone, read
              ? `${read}${flag ? `\n\n${flag}` : ""}\n\n_(I read this from your photo — if anything is unclear, please check with your health worker.)_`
              : `${first}, I couldn't read that clearly 🌸 Try a clearer, well-lit photo, or type your question.`);
            console.log(`[wa] photo read for ${phone}: ${read ? "ok" : "failed"}`);
          } catch (e) {
            console.error("wa photo read error:", e);
            await sendText(phone, `${first}, I had trouble with that photo. Please type your question and I'll help.`);
          }
          continue;
        }

        // Danger-sign fast path: deterministic, BEFORE the AI. A red flag always
        // gets an immediate, correct urgent reply + a clinician alert.
        const danger = detectDangerSign(text);
        if (danger) {
          const first = mother.full_name.split(" ")[0];
          const dr = dangerReply(first, danger);
          await sendText(phone, dr);
          await voiceBack(danger.level === "emergency" ? "Please go to the nearest hospital now. Do not wait." : "Please go to your clinic today. Do not wait.");
          const level = danger.level === "emergency" ? "urgent" : "warning";
          const alert = await createAlert(mother.id, {
            level,
            kind: "danger-sign",
            message: `WhatsApp danger sign — ${danger.sign}: "${text.slice(0, 160)}"`,
          }).catch(() => null);

          // Close the loop so time-to-care is measurable, and pull in the people who
          // actually get her there (Delay 2 + the decision-maker).
          if (alert) {
            const code = newReferralCode();
            await setAlertReferral(alert.id, code, mother.facility_name ?? null).catch(() => {});
            await sendText(phone, `${transportLine(mother)}\n\n${referralLine(code)}`);
          }
          void alertPartnerDanger(mother, danger.sign).catch(() => {});
          if (danger.level === "emergency") void dispatchTransport(mother).catch(() => {});
          logAudit({ mother_id: mother.id, actor: "ai", action: "danger_detected", channel: "whatsapp", summary: danger.sign, meta: { level } });
          console.log(`[wa] DANGER (${danger.sign}) from ${phone} (${mother.full_name}) voice=${viaVoice}`);
          continue;
        }

        // Right to erasure (NDPA 2023) — she can always take her data back.
        if (isDeleteConfirmed(text)) {
          await eraseMotherData(mother.id);
          await sendText(phone, DELETE_DONE_MESSAGE);
          console.log(`[wa] data erased for ${phone}`);
          continue;
        }
        if (isDeleteRequest(text)) { await sendText(phone, DELETE_CONFIRM_MESSAGE); continue; }

        // Consent (NDPA 2023): tell her once, in her language, and record it — but
        // NEVER block the conversation on it. This runs AFTER the danger fast-path,
        // so a mother in danger is never met with a privacy notice.
        if (!mother.consent_at) {
          await sendText(phone, consentMessage(mother.language));
          await recordConsent(mother.id, isConsentAccepted(text) ? CONSENT_VERSION : `${CONSENT_VERSION}-notified`).catch(() => {});
          // fall through and answer her normally
        }

        // Progressive profiling (place → transport → partner), or a restart request.
        if (isProfileSetupRequest(text)) { await sendText(phone, await beginProfileFlow(phone)); continue; }
        const profileReply = await handleProfileStep(mother, text, phone, "whatsapp");
        if (profileReply) { await sendText(phone, profileReply); continue; }

        // "Forward it to Bumply" — WhatsApp is where maternal misinformation spreads,
        // so Bumply is the fact-check layer inside the same app.
        if (text && (isFactCheckRequest(text) || looksLikeForwardedClaim(text))) {
          const check = await checkClaim(text, mother.language).catch(() => null);
          if (check) {
            await sendText(phone, check.reply);
            await voiceBack(check.reply);
            void logMisinfoCheck(mother.id, check.claim, check.verdict, mother.language, "whatsapp").catch(() => {});
            logAudit({ mother_id: mother.id, actor: "ai", action: "misinfo_check", channel: "whatsapp", summary: check.verdict });
            console.log(`[wa] misinfo check (${check.verdict}) for ${phone}`);
            continue;
          }
        }


        // Language switch: "speak yoruba", "language hausa", or "language" for the menu.
        if (isLanguageMenuRequest(text)) { await sendText(phone, LANG_MENU); continue; }
        const newLang = detectLanguageChange(text);
        if (newLang) {
          await updateMotherLanguage(mother.id, newLang);
          await sendText(phone, LANG_CONFIRM[newLang]);
          console.log(`[wa] language → ${newLang} for ${mother.full_name}`);
          continue;
        }

        // Postpartum switch: she tells us the baby has arrived → record birth,
        // congratulate, and hand her the newborn-safety + immunization info.
        if (!mother.birth_date && detectBirthAnnouncement(text)) {
          const first = mother.full_name.split(" ")[0];
          const now = new Date();
          const today = now.toISOString().slice(0, 10);
          await markDelivered(mother.id, today).catch(() => {});
          const firstVisit = immunizationReminder(first, today, now) || "Take your baby to the health centre for the birth-dose vaccines (BCG, OPV 0, Hepatitis B) — they are free.";
          const msg = birthCongratsReply(first, firstVisit);
          await sendText(phone, msg);
          await voiceBack("Congratulations on your new baby! Remember to take the baby for the free vaccines, and watch for danger signs.");
          console.log(`[wa] postpartum: ${mother.full_name} marked delivered`);
          continue;
        }

        const t0 = Date.now();
        const reply = await bumplyReply(mother, text);
        const sent = await sendText(phone, reply);
        console.log(`[wa] reply to ${phone} (${mother.full_name}) voice=${viaVoice}: sent=${sent.ok} in ${Date.now() - t0}ms${sent.error ? ` error=${sent.error}` : ""}`);
        await voiceBack(reply);
      } catch (e) {
        console.error("whatsapp webhook handler error:", e);
      }
    }
  });

  return NextResponse.json({ ok: true });
}
