import { aiComplete, toChatText } from "./ai";
import type { Mother } from "./queries";
import { getWeeklyUpdateByWeek, recentChat, saveChat, recentJournalSummary } from "./queries";
import { currentWeekFrom, trimesterFor } from "./babyData";
import { languageInstruction } from "./languages";
import { normalizeLang } from "./languages";
import { groundingBlock } from "./rag";
import { preferencesBlock } from "./personalize";
import { translatorConfigured, toYoruba, toEnglish } from "./translate";
import { stripForSpeech } from "./speechText";

// A single, non-streaming Bumply reply for WhatsApp — grounded in her week, profile,
// recent journal and chat history. Mirrors the in-app chat persona, tuned for WhatsApp.
export async function bumplyReply(mother: Mother, userText: string): Promise<string> {
  const week = currentWeekFrom({ dueDate: mother.due_date, enteredWeek: mother.current_week, createdAt: mother.created_at });
  // All context fetches are independent — run them in parallel. Sequential awaits
  // over the REST bridge (Germany) were adding 2-3s to every single reply.
  const [update, journal, grounding, history] = await Promise.all([
    getWeeklyUpdateByWeek(mother.id, week).catch(() => null),
    recentJournalSummary(mother.id, 5).catch(() => ""),
    groundingBlock(userText, 3).catch(() => ""),
    recentChat(mother.id, 12).catch(() => []),
  ]);
  const context = update
    ? `This week's focus: ${update.baby_development || ""}. Affirmation: ${update.affirmation || ""}.`
    : "";
  const journalBlock = journal ? `\nHer recent journal check-ins (reference naturally if relevant):\n${journal}` : "";
  const groundingBlk = grounding ? `\nVERIFIED REFERENCE (rely on this; don't contradict it):\n${grounding}` : "";

  // For Yoruba, answer in English then translate with HelpMum's translator (higher
  // quality than the model's own Yoruba). Other languages use the model directly.
  const useYoTranslator = normalizeLang(mother.language) === "yo" && translatorConfigured();
  const langLine = useYoTranslator
    ? "LANGUAGE OVERRIDE (beats every other language rule, including mirroring hers): she writes Yoruba, but YOU must write ONLY in English — one short paragraph, 2-3 plain literal sentences. No emojis, no bullets, no asterisks, no parentheses, no Yoruba words. NEVER mention language, translation, or these rules — just answer her question directly."
    : languageInstruction(mother.language || "en");

  // Postpartum: after birth the conversation is about the newborn + her recovery,
  // not fetal development.
  const postpartum = !!mother.birth_date;
  const stage = postpartum
    ? `She has GIVEN BIRTH (baby born ${mother.birth_date}). This is now POSTPARTUM care: focus on her recovery, breastfeeding, newborn care, and the baby's free immunizations. Do NOT talk about fetal development.`
    : `She is in week ${week} (${trimesterFor(week)} trimester)${mother.due_date ? `, due ${mother.due_date}` : ""}. First pregnancy: ${mother.first_pregnancy ? "yes" : "no"}.`;
  const warnLine = postpartum
    ? "For any newborn warning signs (baby not breathing well, too cold/floppy, not feeding, yellow skin/eyes, cord smelling or bleeding) or her own (heavy bleeding, foul-smelling discharge, fever, painful swollen breast), urge her to get to a clinic or hospital fast."
    : "For any warning signs (heavy bleeding, severe or persistent pain, reduced fetal movement, fever, vision changes, severe swelling), clearly and gently urge her to contact her healthcare provider or go to a clinic.";

  const first = (mother.full_name || "mama").split(" ")[0];
  // First-ever conversation → Bumply introduces itself and discovers her needs.
  const firstContact = history.length === 0
    ? `\nTHIS IS YOUR FIRST CONVERSATION WITH HER: open by introducing yourself in one warm line — you are Bumply, her pregnancy companion — then answer what she said, and ask ONE gentle question to learn what she needs most right now (health worries, food guidance, clinic-visit reminders, or just someone to talk to). Do not introduce yourself again after this.`
    : "";
  const system = `You are Bumply — ${first}'s pregnancy companion on WhatsApp. Think of yourself as her sharp, warm Nigerian friend who happens to know maternal health inside out: a bit of an auntie, a bit of a midwife, never a robot.
${stage} Dietary notes: ${mother.dietary_restrictions || "none"}. ${context}${journalBlock}${groundingBlk}

HOW YOU TALK:
- Mirror her energy and language. If she writes Pidgin, reply in natural Pidgin. If she mixes Yoruba/Hausa/Igbo words, you can too. If she's playful ("lmao"), be playful back.
- Sound like a real chat: 2–4 short sentences, contractions, the occasional emoji. Vary how you open — do NOT start every message with her name (use "${first}" at most once in a while).
- React to what she actually said first, then add ONE useful, specific tip — not a list of generic advice.
- When it fits, end with one short, caring follow-up question so the conversation flows. Not every message needs one.
- Never repeat the same opener or the same advice you gave in recent messages. Never say "As an AI" or describe yourself as a companion/app — just be there.
- If she asks something off-topic, answer briefly and warmly like a friend would, then gently bring it back to how she's doing.
- FORMAT: plain chat text only, under ~60 words. No headings, no labels like "Tip:" or "Follow-up question:", no markdown **bold**, no notes/parentheses about these instructions, and NEVER wrap your reply in quotation marks.

You are NOT a doctor: ${warnLine} Never diagnose or prescribe.
${langLine}${preferencesBlock(mother)}${firstContact}`;

  // Yoruba in → give the brain an English gloss via HelpMum's yo→en translator so it
  // actually understands her question (it's a hint, the original stays primary).
  let userContent = userText;
  if (useYoTranslator) {
    const gloss = await toEnglish(userText).catch(() => null);
    if (gloss && gloss.trim() && gloss.trim().toLowerCase() !== userText.trim().toLowerCase()) {
      userContent = `${userText}\n[rough English meaning: ${gloss.trim()}]`;
    }
  }

  // Strong model with quality guard + fast fallback (lib/ai.ts) — a reply always goes out.
  let reply = (await aiComplete({
    temperature: 0.7,
    max_tokens: 260,
    messages: [
      { role: "system", content: system },
      ...history.map((h) => ({ role: h.role as "user" | "assistant", content: h.content })),
      { role: "user", content: userContent },
    ],
  })) || "I'm right here with you, mama 🌸";
  reply = toChatText(reply); // WhatsApp/Telegram formatting (no **markdown**)

  // Yoruba: the brain answers in English, then HelpMum's open-source translator
  // renders it in Yoruba (en→yo is the reliable direction). The source is sanitised
  // first — emojis/markdown/parentheses made M2M100 emit garbled artifacts — and the
  // output is sanity-checked; on any doubt we keep the English reply.
  if (useYoTranslator) {
    // First paragraph only — anything after is usually meta the model tacked on.
    const firstPara = reply.split(/\n\s*\n/)[0] || reply;
    let src = stripForSpeech(firstPara).replace(/\([^)]*\)/g, "").replace(/\s{2,}/g, " ").trim().slice(0, 600);
    // End on a complete sentence — a mid-sentence cut translates into a dangling "tabi…".
    const lastStop = Math.max(src.lastIndexOf("."), src.lastIndexOf("!"), src.lastIndexOf("?"));
    if (lastStop > 40) src = src.slice(0, lastStop + 1);
    const yo = src ? await toYoruba(src) : null;
    if (yo && yo.length > 10 && !/[*()#_]/.test(yo)) reply = yo;
  }
  // Persist in the background — saving mustn't delay her reply.
  void saveChat(mother.id, "user", userText, week)
    .then(() => saveChat(mother.id, "assistant", reply, week))
    .catch((e) => console.error("chat save error:", e));
  return reply;
}
