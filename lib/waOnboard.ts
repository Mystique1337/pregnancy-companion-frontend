// Self-onboarding over a chat channel (WhatsApp OR Telegram): an unknown user can
// join Bumply by chatting alone — no app, no signup form. We ask name → weeks/due-date,
// then create their mother record. State lives in preg_companion.wa_onboarding keyed by
// a per-channel stateKey (phone digits for WhatsApp, `tg:<chatId>` for Telegram).
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { getOnboarding, setOnboarding, clearOnboarding, createMother, linkTelegramChat, type Mother } from "@/lib/queries";
import { trimesterFor, currentWeekFrom } from "@/lib/babyData";
import { normalizeLang } from "@/lib/languages";

const GREETING = /^(hi+|hello+|hey+|start|begin|join|good\s*(morning|afternoon|evening)|ba?wo|abeg|help|menu|sannu|ndewo)\b/i;

// Pull a plausible "weeks pregnant" number, or a due date, from free text.
export function parseWeek(text: string): number | null {
  const t = text.toLowerCase();
  const wk = t.match(/\b(\d{1,2})\s*(?:weeks?|wks?|w)\b/) || t.match(/\bweek\s*(\d{1,2})\b/) || t.match(/^\s*(\d{1,2})\s*$/);
  if (wk) { const n = Number(wk[1]); if (n >= 1 && n <= 42) return n; }
  const mo = t.match(/\b(\d{1,2})\s*months?\b/);
  if (mo) { const n = Math.round(Number(mo[1]) * 4.3); if (n >= 1 && n <= 42) return n; }
  if (/\b(due|edd|expect)/.test(t) || /\b20\d\d\b/.test(t) || /(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/.test(t)) {
    const cleaned = text.replace(/\b(due|edd|expected?|date|in|on|around|about)\b/gi, " ").trim();
    const ms = Date.parse(cleaned);
    if (!Number.isNaN(ms)) {
      const wkFromDue = currentWeekFrom({ dueDate: new Date(ms).toISOString(), enteredWeek: null });
      if (wkFromDue >= 1 && wkFromDue <= 42) return wkFromDue;
    }
  }
  return null;
}

export function cleanName(text: string): string {
  return text
    .replace(/^\s*(my\s+name\s+is|i\s*am|i'?m|this\s+is|call\s+me|na\s+me|na)\s+/i, "")
    .replace(/[^\p{L}\p{M}\s'’-]/gu, "")
    .trim()
    .split(/\s+/).slice(0, 3).join(" ");
}

export type OnboardResult =
  | { kind: "reply"; text: string }
  | { kind: "done"; text: string; mother: Mother }
  | { kind: "skip" };

// A channel abstracts WHERE onboarding state lives and HOW the mother is created.
export type OnboardChannel = {
  stateKey: string;
  create: (name: string, week: number, trimester: string) => Promise<Mother>;
};

const WELCOME = "Welcome to Bumply 🌸 I'm your free pregnancy helper. I can answer your questions, check for danger signs, and remind you about clinic visits — any time.\n\nWhat is your first name?";

// Drive one turn of onboarding. Call only after the user was not found as a mother.
export async function handleOnboarding(text: string, ch: OnboardChannel): Promise<OnboardResult> {
  const state = await getOnboarding(ch.stateKey);

  if (!state) {
    await setOnboarding(ch.stateKey, "ask_name", {});
    return { kind: "reply", text: WELCOME };
  }

  if (state.step === "ask_name") {
    const name = cleanName(text);
    if (!name || (GREETING.test(text) && name.length < 2)) {
      return { kind: "reply", text: "No wahala 🙂 Just tell me the name you'd like me to call you." };
    }
    await setOnboarding(ch.stateKey, "ask_week", { name });
    return {
      kind: "reply",
      text: `Lovely to meet you, ${name}! 💛\n\nHow many weeks pregnant are you? Reply with a number (like *20*).\n\nNot sure? Tell me your due date or which month you're expecting, and I'll work it out.`,
    };
  }

  if (state.step === "ask_week") {
    const week = parseWeek(text);
    if (week == null) {
      return { kind: "reply", text: "Almost there! Just reply with how many weeks pregnant you are — a number like *20*. If you don't know, tell me the month your baby is due." };
    }
    const name = String(state.data?.name || "").trim() || "mama";
    try {
      const mother = await ch.create(name, week, trimesterFor(week));
      await clearOnboarding(ch.stateKey);
      return {
        kind: "done",
        mother,
        text: `You're all set, ${name}! 🎉 You're in *week ${week}* — ${trimesterFor(week)} trimester.\n\nFrom now on you can just message me:\n• Ask me anything about your pregnancy\n• Send a voice note if you'd rather talk\n• Send a photo of your ANC card or medicine and I'll read it\n• I'll watch for danger signs and tell you to get help fast\n\nHow are you feeling today?`,
      };
    } catch {
      await clearOnboarding(ch.stateKey);
      return { kind: "reply", text: "You're all set 🌸 Go ahead and ask me anything about your pregnancy." };
    }
  }

  return { kind: "skip" };
}

async function freshHash(): Promise<string> {
  return bcrypt.hash(randomBytes(12).toString("hex"), 10);
}

// WhatsApp channel — minimal wa<digits>@bumply.chw record keyed by phone digits.
export function whatsappChannel(digits: string): OnboardChannel {
  return {
    stateKey: digits,
    create: async (name, week, trimester) =>
      createMother({
        email: `wa${digits}@bumply.chw`,
        password_hash: await freshHash(),
        full_name: name,
        phone: digits,
        whatsapp_number: digits,
        current_week: week,
        weeks_completed: week,
        trimester,
        first_pregnancy: true,
        source: "whatsapp",
        language: normalizeLang(undefined),
      }),
  };
}

// Telegram channel — tg<chatId>@bumply.tg record, linked to the Telegram chat.
export function telegramChannel(chatId: string): OnboardChannel {
  return {
    stateKey: `tg:${chatId}`,
    create: async (name, week, trimester) => {
      const mother = await createMother({
        email: `tg${chatId}@bumply.tg`,
        password_hash: await freshHash(),
        full_name: name,
        current_week: week,
        weeks_completed: week,
        trimester,
        first_pregnancy: true,
        source: "telegram",
        language: normalizeLang(undefined),
      });
      await linkTelegramChat(mother.id, chatId);
      return mother;
    },
  };
}
