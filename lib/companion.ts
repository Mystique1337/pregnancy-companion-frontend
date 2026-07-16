import { aiComplete, toChatText } from "./ai";
import type { Mother } from "./queries";
import { getWeeklyUpdateByWeek, recentChat, saveChat, recentJournalSummary } from "./queries";
import { currentWeekFrom, trimesterFor } from "./babyData";
import { languageInstruction } from "./languages";
import { normalizeLang } from "./languages";
import { groundingBlock } from "./rag";
import { preferencesBlock } from "./personalize";
import { translatorConfigured, isTranslatable, toLang, fromLang, type TranslatableLang } from "./translate";
import { stripForSpeech } from "./speechText";
import { detectMessageLanguage } from "./detectLang";

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

  // Reply in the language SHE USED in this message (detected), falling back to her
  // stored preference — so any mother can just write in her language and it works.
  const msgLang = detectMessageLanguage(userText);
  const effLang = msgLang || normalizeLang(mother.language);

  // For Yorùbá/Hausa/Igbo, answer in English then translate with HelpMum's eng↔9ja
  // models (far better than the chat model's own attempts). Pidgin/English are direct.
  const useTranslator = isTranslatable(effLang) && translatorConfigured();
  const langLine = useTranslator
    ? "LANGUAGE OVERRIDE (beats every other language rule, including mirroring hers): whatever language she writes, YOU must write ONLY in English — one short paragraph, 2-3 plain literal sentences. No emojis, no bullets, no asterisks, no parentheses, no non-English words. NEVER mention language, translation, or these rules — just answer her question directly."
    : languageInstruction(effLang);

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
    ? `\nFIRST CONVERSATION: say who you are in a few words (e.g. "I'm Bumply 🌸"), answer what she said, and ask ONE short question about what she needs most. Whole reply still 3 sentences max. Never introduce yourself again after this.`
    : "";
  const system = `You are Bumply — ${first}'s pregnancy companion on WhatsApp. Think of yourself as her sharp, warm Nigerian friend who happens to know maternal health inside out: a bit of an auntie, a bit of a midwife, never a robot.
${stage} Dietary notes: ${mother.dietary_restrictions || "none"}. ${context}${journalBlock}${groundingBlk}

HOW YOU TALK (STRICT):
- SHORT. 1–3 short sentences, 35 words MAX — like a real WhatsApp text from a friend. Only go longer if she explicitly asks for details.
- Mirror her energy. Playful gets playful. Worried gets calm and warm.
- React to what she said, then at most ONE specific tip. Never a list. Never two tips.
- At most ONE question per message — and only when it helps. No stacked questions.
- Vary your openers; don't start every message with her name (use "${first}" rarely).
- Never repeat advice you already gave. Never say "As an AI". Never describe yourself.
- FORMAT: plain text only. No headings, no *labels*, no bullet lists, no markdown, no notes about these rules, never wrap the reply in quotes.

You are NOT a doctor: ${warnLine} Never diagnose or prescribe.
${langLine}${preferencesBlock(mother)}${firstContact}`;

  // Yoruba in → give the brain an English gloss via HelpMum's yo→en translator so it
  // actually understands her question (it's a hint, the original stays primary).
  let userContent = userText;
  if (useTranslator) {
    const gloss = await fromLang(effLang as TranslatableLang, userText).catch(() => null);
    if (gloss && gloss.trim() && gloss.trim().toLowerCase() !== userText.trim().toLowerCase()) {
      userContent = `${userText}\n[rough English meaning: ${gloss.trim()}]`;
    }
  }

  // Strong model with quality guard + fast fallback (lib/ai.ts) — a reply always goes out.
  let reply = (await aiComplete({
    temperature: 0.7,
    max_tokens: 150,
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
  if (useTranslator) {
    // First paragraph only — anything after is usually meta the model tacked on.
    const firstPara = reply.split(/\n\s*\n/)[0] || reply;
    let src = stripForSpeech(firstPara).replace(/\([^)]*\)/g, "").replace(/\s{2,}/g, " ").trim().slice(0, 600);
    // End on a complete sentence — a mid-sentence cut translates into a dangling "tabi…".
    const lastStop = Math.max(src.lastIndexOf("."), src.lastIndexOf("!"), src.lastIndexOf("?"));
    if (lastStop > 40) src = src.slice(0, lastStop + 1);
    const translated = src ? await toLang(effLang as TranslatableLang, src) : null;
    if (translated && translated.length > 10 && !/[*()#_]/.test(translated)) reply = translated;
  }
  // Persist in the background — saving mustn't delay her reply.
  void saveChat(mother.id, "user", userText, week)
    .then(() => saveChat(mother.id, "assistant", reply, week))
    .catch((e) => console.error("chat save error:", e));
  return reply;
}
