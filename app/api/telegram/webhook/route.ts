import { NextResponse, after } from "next/server";
import {
  getMotherByTelegram, getMotherByTelegramToken, getMotherByEmail, getMotherByPhone,
  linkTelegramChat, createAlert, markDelivered, getOnboarding, type Mother,
} from "@/lib/queries";
import { publicBaseUrl } from "@/lib/baseUrl";
import { getSettings } from "@/lib/settings";
import { bumplyReply } from "@/lib/companion";
import { sendTelegram, telegramSecret, sendChatAction, downloadTelegramFile, sendVoiceReply } from "@/lib/telegram";
import { transcribe, speak, normalizeVoice, warm } from "@/lib/voice";
import { wavToMp3 } from "@/lib/audio";
import { currentWeekFrom, getBabyData, babySizeText, trimesterFor } from "@/lib/babyData";
import { dailyTipFor } from "@/lib/dailyTips";
import { detectDangerSign, dangerReply } from "@/lib/dangerSigns";
import { handleOnboarding, telegramChannel } from "@/lib/waOnboard";
import { detectBirthAnnouncement, birthCongratsReply } from "@/lib/postpartum";
import { immunizationReminder } from "@/lib/immunization";
import { readImage, safetyNote, visionConfigured } from "@/lib/vision";
import { detectLanguageChange, isLanguageMenuRequest, LANG_CONFIRM, LANG_MENU } from "@/lib/langSwitch";
import { updateMotherLanguage } from "@/lib/queries";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET() {
  return NextResponse.json({ ok: true });
}

async function handleCommand(chatId: string, mother: Mother, cmd: string) {
  const c = cmd.split(/\s+/)[0].toLowerCase();
  const week = currentWeekFrom({ dueDate: mother.due_date, enteredWeek: mother.current_week, createdAt: mother.created_at });
  if (c === "/week") {
    const baby = getBabyData(week);
    const size = baby ? babySizeText(week) : "growing beautifully 🌱";
    await sendTelegram(chatId, `📅 You're in week ${week} (${trimesterFor(week)} trimester). Your baby is ${size}. ${Math.max(0, 40 - week)} weeks to go! 🌸`);
  } else if (c === "/tips") {
    await sendTelegram(chatId, `🌿 ${dailyTipFor(week, week)}`);
  } else if (c === "/emergency" || c === "/sos") {
    await createAlert(mother.id, { level: "urgent", kind: "emergency", message: `🚨 EMERGENCY requested via Telegram by ${mother.full_name}.` }).catch(() => {});
    const base = publicBaseUrl();
    await sendTelegram(chatId, `🚨 If this is life-threatening — heavy bleeding, fits, severe pain, or your baby not moving — go to the nearest hospital NOW. Don't wait.\n\nI've alerted your clinician.${base ? `\n\nOpen Emergency Mode to find the nearest hospital and alert your loved one:\n${base}/emergency` : ""}`);
  } else if (c === "/language" || c === "/lang") {
    await sendTelegram(chatId, LANG_MENU);
  } else {
    await sendTelegram(chatId, "I'm Bumply 🌸 your pregnancy companion. Just talk to me — type, send a voice note, or send a photo of your ANC card/medicine and I'll help. Try:\n• /week — your week & baby size\n• /tips — a tip for today\n• /language — chat in English, Pidgin, Yorùbá, Hausa or Igbo\n• /emergency — get help fast\nOr ask me anything: symptoms, food, what's normal, how you're feeling.");
  }
}

export async function POST(req: Request) {
  const secret = telegramSecret();
  if (secret && req.headers.get("x-telegram-bot-api-secret-token") !== secret) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const msg = body.message || body.edited_message;
  const chatId = String(msg?.chat?.id || msg?.from?.id || "");
  const text = String(msg?.text || "").trim();
  const voice = msg?.voice || msg?.audio;
  const photo = Array.isArray(msg?.photo) && msg.photo.length ? msg.photo[msg.photo.length - 1] : null; // largest size
  const caption = String(msg?.caption || "").trim();
  if (!chatId || (!text && !voice && !photo)) return NextResponse.json({ ok: true });

  after(async () => {
    try {
      // Instant feedback: show "typing…" before ANY database work, and fetch the
      // independent lookups in parallel (each is a round-trip to the DB bridge).
      void sendChatAction(chatId, "typing").catch(() => {});
      const t0 = Date.now();
      const [settings, mother] = await Promise.all([getSettings(), getMotherByTelegram(chatId)]);
      if (!settings.chat_enabled) return;

      // Resolve the message text — transcribe voice notes with Whisper.
      let userText = text;
      const viaVoice = !userText && !!voice;
      if (viaVoice) {
        // Warm both Modal voice engines now — avoids a second ~25s cold start
        // when we synthesise the voice reply.
        void warm().catch(() => {});
        await sendChatAction(chatId, "typing");
        try { userText = (await transcribe(await downloadTelegramFile(voice.file_id), "voice.ogg")).trim(); } catch { userText = ""; }
      }

      // If she spoke, reply with a voice note too (in her language).
      const voiceBack = async (m: string) => {
        if (!viaVoice || !mother) return;
        try { await sendVoiceReply(chatId, await wavToMp3(await speak(m.slice(0, 600), normalizeVoice(mother.language)))); } catch { /* text already sent */ }
      };

      // Danger-sign fast path (everyone, before the AI): instant urgent reply + alert.
      if (userText) {
        const danger = detectDangerSign(userText);
        if (danger) {
          const first = mother ? mother.full_name.split(" ")[0] : "mama";
          await sendTelegram(chatId, dangerReply(first, danger));
          await voiceBack(danger.level === "emergency" ? "Please go to the nearest hospital now. Do not wait." : "Please go to your clinic today. Do not wait.");
          if (mother) {
            await createAlert(mother.id, {
              level: danger.level === "emergency" ? "urgent" : "warning",
              kind: "danger-sign",
              message: `Telegram danger sign — ${danger.sign}: "${userText.slice(0, 160)}"`,
            }).catch(() => {});
          }
          console.log(`[tg] DANGER (${danger.sign}) from ${chatId}${mother ? " (" + mother.full_name + ")" : " (unregistered)"}`);
          return;
        }
      }

      // Unknown chat → self-onboarding (or link an existing account by code/email/phone).
      if (!mother) {
        if (!userText && photo) { await sendTelegram(chatId, "Hi 🌸 Welcome to Bumply! Send me a message (like *hi*) to get started, and I can also read your ANC card or medicine once you've joined."); return; }
        const inProgress = await getOnboarding(`tg:${chatId}`);
        if (!inProgress) {
          const candidate = text.replace(/^\/start\s*/i, "").trim();
          let found = await getMotherByTelegramToken(candidate);
          if (!found && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(candidate)) found = await getMotherByEmail(candidate);
          if (!found && /\d{7,}/.test(candidate.replace(/\D/g, ""))) found = await getMotherByPhone(candidate);
          if (found) {
            await linkTelegramChat(found.id, chatId);
            await sendTelegram(chatId, `✓ Linked, ${found.full_name.split(" ")[0]}! 🌸 You can now chat with Bumply here — type, send a voice note, or a photo. Try /week or just ask me anything.`);
            return;
          }
        }
        const res = await handleOnboarding(userText, telegramChannel(chatId));
        if (res.kind !== "skip") await sendTelegram(chatId, res.text);
        console.log(`[tg] onboarding ${res.kind} for ${chatId}`);
        return;
      }

      // Photo understanding: read an ANC card / drug / test result.
      if (photo) {
        const first = mother.full_name.split(" ")[0];
        if (!visionConfigured()) { await sendTelegram(chatId, `${first}, I can't read photos just yet 🌸 Please type your question and I'll help.`); return; }
        await sendChatAction(chatId, "typing");
        await sendTelegram(chatId, "📷 Let me look at that for you…");
        try {
          const img = await downloadTelegramFile(photo.file_id);
          const prompt = caption
            ? `A pregnant or new mother sent this photo and asks: "${caption}". Read the photo and answer her simply and kindly in plain English. If anything looks worrying, tell her to see a health worker. Do not diagnose.`
            : undefined;
          const read = img ? await readImage(img, prompt) : null;
          const flag = read ? await safetyNote(read) : "";
          await sendTelegram(chatId, read
            ? `${read}${flag ? `\n\n${flag}` : ""}\n\n_(I read this from your photo — if anything is unclear, please check with your health worker.)_`
            : `${first}, I couldn't read that clearly 🌸 Try a clearer, well-lit photo, or type your question.`);
        } catch (e) {
          console.error("tg photo read error:", e);
          await sendTelegram(chatId, `${first}, I had trouble with that photo. Please type your question and I'll help.`);
        }
        return;
      }

      // Voice that couldn't be transcribed.
      if (!userText) {
        await sendTelegram(chatId, "Sorry, I couldn't hear that clearly 🌸 Please try again, or type your message.");
        return;
      }

      // Language switch: "speak yoruba", "/language hausa", or "/language" for the menu.
      if (isLanguageMenuRequest(userText)) { await sendTelegram(chatId, LANG_MENU); return; }
      const newLang = detectLanguageChange(userText);
      if (newLang) {
        await updateMotherLanguage(mother.id, newLang);
        await sendTelegram(chatId, LANG_CONFIRM[newLang]);
        console.log(`[tg] language → ${newLang} for ${mother.full_name}`);
        return;
      }

      // Postpartum switch: she tells us the baby arrived.
      if (!mother.birth_date && detectBirthAnnouncement(userText)) {
        const first = mother.full_name.split(" ")[0];
        const now = new Date();
        const today = now.toISOString().slice(0, 10);
        await markDelivered(mother.id, today).catch(() => {});
        const firstVisit = immunizationReminder(first, today, now) || "Take your baby to the health centre for the birth-dose vaccines (BCG, OPV 0, Hepatitis B) — they are free.";
        await sendTelegram(chatId, birthCongratsReply(first, firstVisit));
        await voiceBack("Congratulations on your new baby! Remember to take the baby for the free vaccines, and watch for danger signs.");
        console.log(`[tg] postpartum: ${mother.full_name} marked delivered`);
        return;
      }

      // Commands.
      if (userText.startsWith("/")) { await handleCommand(chatId, mother, userText); return; }

      // The brain — grounded reply (+ voice note back if she spoke).
      void sendChatAction(chatId, "typing").catch(() => {});
      const reply = await bumplyReply(mother, userText);
      const r = await sendTelegram(chatId, reply);
      console.log(`[tg] reply to ${chatId} (${mother.full_name}) voice=${viaVoice}: sent=${r.sent} in ${Date.now() - t0}ms`);
      await voiceBack(reply);
    } catch (e) {
      console.error("telegram webhook error:", e);
    }
  });

  return NextResponse.json({ ok: true });
}
