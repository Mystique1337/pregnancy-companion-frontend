// WhatsApp self-onboarding: an unknown number can join Bumply by chat alone —
// no app, no signup form. We walk her through name → weeks/due-date over WhatsApp,
// then create her mother record (the same minimal wa<digits>@bumply.chw pattern a
// CHW enrolment uses). State lives in preg_companion.wa_onboarding until she's done.
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { getOnboarding, setOnboarding, clearOnboarding, createMother, type Mother } from "@/lib/queries";
import { currentWeekFrom, trimesterFor } from "@/lib/babyData";
import { normalizeLang } from "@/lib/languages";

const GREETING = /^(hi+|hello+|hey+|start|begin|join|good\s*(morning|afternoon|evening)|ba?wo|abeg|help|menu|sannu|ndewo)\b/i;

// Pull a plausible "weeks pregnant" number, or a due date, from free text.
// Returns the current gestational week (1..42) or null if we can't tell.
export function parseWeek(text: string): number | null {
  const t = text.toLowerCase();
  // "20 weeks", "week 20", or a bare number
  const wk = t.match(/\b(\d{1,2})\s*(?:weeks?|wks?|w)\b/) || t.match(/\bweek\s*(\d{1,2})\b/) || t.match(/^\s*(\d{1,2})\s*$/);
  if (wk) {
    const n = Number(wk[1]);
    if (n >= 1 && n <= 42) return n;
  }
  // "months": convert to weeks (rough, ×4.3)
  const mo = t.match(/\b(\d{1,2})\s*months?\b/);
  if (mo) {
    const n = Math.round(Number(mo[1]) * 4.3);
    if (n >= 1 && n <= 42) return n;
  }
  // A due date anywhere in the text (e.g. "due in December", "15 Jan 2027").
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
  // Strip common lead-ins ("my name is", "I am", "call me") and punctuation.
  const n = text
    .replace(/^\s*(my\s+name\s+is|i\s*am|i'?m|this\s+is|call\s+me|na\s+me|na)\s+/i, "")
    .replace(/[^\p{L}\p{M}\s'’-]/gu, "")
    .trim()
    .split(/\s+/).slice(0, 3).join(" ");
  return n;
}

export type OnboardResult =
  | { kind: "reply"; text: string }                    // still onboarding — send this and stop
  | { kind: "done"; text: string; mother: Mother }     // enrolled — send welcome, then normal flow may follow
  | { kind: "skip" };                                  // not an onboarding turn

// Drive one turn of onboarding for an unregistered number. Call this only after
// getMotherByPhone() returned null.
export async function handleOnboarding(phone: string, text: string): Promise<OnboardResult> {
  const digits = phone.replace(/\D/g, "");
  const state = await getOnboarding(digits);

  // First contact ever: greet + ask for her name.
  if (!state) {
    await setOnboarding(digits, "ask_name", {});
    return {
      kind: "reply",
      text: "Welcome to Bumply 🌸 I'm your free pregnancy helper on WhatsApp. I can answer your questions, check for danger signs, and remind you about clinic visits — any time.\n\nWhat is your first name?",
    };
  }

  if (state.step === "ask_name") {
    const name = cleanName(text);
    // If she just said hi again (no real name), re-ask once.
    if (!name || (GREETING.test(text) && name.length < 2)) {
      return { kind: "reply", text: "No wahala 🙂 Just tell me the name you'd like me to call you." };
    }
    await setOnboarding(digits, "ask_week", { name });
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
    const email = `wa${digits}@bumply.chw`;
    const password_hash = await bcrypt.hash(randomBytes(12).toString("hex"), 10);
    try {
      const mother = await createMother({
        email,
        password_hash,
        full_name: name,
        phone: digits,
        whatsapp_number: digits,
        current_week: week,
        weeks_completed: week,
        trimester: trimesterFor(week),
        first_pregnancy: true,
        source: "whatsapp",
        language: normalizeLang(undefined),
      });
      await clearOnboarding(digits);
      return {
        kind: "done",
        mother,
        text: `You're all set, ${name}! 🎉 You're in *week ${week}* — ${trimesterFor(week)} trimester.\n\nFrom now on you can just message me:\n• Ask me anything about your pregnancy\n• Send a voice note if you'd rather talk\n• I'll watch for danger signs and tell you to get help fast\n\nHow are you feeling today?`,
      };
    } catch {
      // Duplicate/edge — don't trap her in the flow.
      await clearOnboarding(digits);
      return { kind: "reply", text: "You're all set 🌸 Go ahead and ask me anything about your pregnancy." };
    }
  }

  return { kind: "skip" };
}
