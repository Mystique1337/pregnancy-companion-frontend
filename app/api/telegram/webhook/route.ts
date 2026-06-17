import { NextResponse, after } from "next/server";
import { getMotherByTelegram, getMotherByTelegramToken, getMotherByEmail, getMotherByPhone, linkTelegramChat, createAlert, type Mother } from "@/lib/queries";
import { publicBaseUrl } from "@/lib/baseUrl";
import { getSettings } from "@/lib/settings";
import { bumplyReply } from "@/lib/companion";
import { sendTelegram, telegramSecret, sendChatAction, downloadTelegramFile, sendVoiceReply } from "@/lib/telegram";
import { transcribe, speak } from "@/lib/voice";
import { wavToMp3 } from "@/lib/audio";
import { currentWeekFrom, getBabyData, babySizeText, trimesterFor } from "@/lib/babyData";
import { dailyTipFor } from "@/lib/dailyTips";

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
  } else {
    await sendTelegram(chatId, "I'm Bumply 🌸 your pregnancy companion. Just talk to me — type or send a voice note and I'll help. Try:\n• /week — your week & baby size\n• /tips — a tip for today\n• /emergency — get help fast\nOr ask me anything: symptoms, food, what's normal, how you're feeling.");
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
  if (!chatId || (!text && !voice)) return NextResponse.json({ ok: true });

  after(async () => {
    try {
      const mother = await getMotherByTelegram(chatId);

      // Not linked → accept link code / email / phone (text only).
      if (!mother) {
        const candidate = text.replace(/^\/start\s*/i, "").trim();
        let found = await getMotherByTelegramToken(candidate);
        if (!found && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(candidate)) found = await getMotherByEmail(candidate);
        if (!found && /\d{7,}/.test(candidate.replace(/\D/g, ""))) found = await getMotherByPhone(candidate);
        if (found) {
          await linkTelegramChat(found.id, chatId);
          await sendTelegram(chatId, `✓ Linked, ${found.full_name.split(" ")[0]}! 🌸 You can now chat with Bumply here — type or send a voice note. Try /week or just ask me anything.`);
        } else {
          await sendTelegram(chatId, "Hi, I'm Bumply 🌸 your pregnancy companion. To connect, open Bumply → Account → Telegram, copy your link code, and paste it here.");
        }
        return;
      }

      const settings = await getSettings();
      if (!settings.chat_enabled) return;

      // Resolve the message — transcribe voice notes with Whisper.
      let userText = text;
      const viaVoice = !!voice;
      if (viaVoice) {
        await sendChatAction(chatId, "typing");
        try {
          const audio = await downloadTelegramFile(voice.file_id);
          userText = await transcribe(audio, "voice.ogg");
        } catch {
          userText = "";
        }
        if (!userText) {
          await sendTelegram(chatId, "Sorry, I couldn't hear that clearly 🌸 Please try again, or type your message.");
          return;
        }
      }

      if (userText.startsWith("/")) {
        await handleCommand(chatId, mother, userText);
        return;
      }

      await sendChatAction(chatId, "typing");
      const reply = await bumplyReply(mother, userText);
      const r = await sendTelegram(chatId, reply);

      // If she spoke, reply with a voice note too (her language).
      if (viaVoice) {
        try {
          const wav = await speak(reply, (mother.language as never) || "en");
          await sendVoiceReply(chatId, await wavToMp3(wav));
        } catch { /* text already sent */ }
      }
      console.log(`[tg] reply to ${chatId} (${mother.full_name}) voice=${viaVoice}: sent=${r.sent}`);
    } catch (e) {
      console.error("telegram webhook error:", e);
    }
  });

  return NextResponse.json({ ok: true });
}
