import { aiComplete, toChatText } from "./ai";
import type { Mother } from "./queries";
import { getWeeklyUpdateByWeek, recentChat, saveChat, recentJournalSummary } from "./queries";
import { currentWeekFrom, trimesterFor } from "./babyData";
import { languageInstruction } from "./languages";
import { normalizeLang } from "./languages";
import { groundingBlock } from "./rag";
import { preferencesBlock } from "./personalize";
import { translatorConfigured, toYoruba } from "./translate";

// A single, non-streaming Bumply reply for WhatsApp — grounded in her week, profile,
// recent journal and chat history. Mirrors the in-app chat persona, tuned for WhatsApp.
export async function bumplyReply(mother: Mother, userText: string): Promise<string> {
  const week = currentWeekFrom({ dueDate: mother.due_date, enteredWeek: mother.current_week, createdAt: mother.created_at });
  const update = await getWeeklyUpdateByWeek(mother.id, week);
  const context = update
    ? `This week's focus: ${update.baby_development || ""}. Affirmation: ${update.affirmation || ""}.`
    : "";
  const journal = await recentJournalSummary(mother.id, 5);
  const journalBlock = journal ? `\nHer recent journal check-ins (reference naturally if relevant):\n${journal}` : "";
  const grounding = await groundingBlock(userText, 3);
  const groundingBlk = grounding ? `\nVERIFIED REFERENCE (rely on this; don't contradict it):\n${grounding}` : "";

  // For Yoruba, answer in English then translate with HelpMum's translator (higher
  // quality than the model's own Yoruba). Other languages use the model directly.
  const useYoTranslator = normalizeLang(mother.language) === "yo" && translatorConfigured();
  const langLine = useYoTranslator
    ? "Reply in clear, simple English (it will be translated to Yoruba for her)."
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
  const system = `You are Bumply — ${first}'s pregnancy companion on WhatsApp. Think of yourself as her sharp, warm Nigerian friend who happens to know maternal health inside out: a bit of an auntie, a bit of a midwife, never a robot.
${stage} Dietary notes: ${mother.dietary_restrictions || "none"}. ${context}${journalBlock}${groundingBlk}

HOW YOU TALK:
- Mirror her energy and language. If she writes Pidgin, reply in natural Pidgin. If she mixes Yoruba/Hausa/Igbo words, you can too. If she's playful ("lmao"), be playful back.
- Sound like a real chat: 2–4 short sentences, contractions, the occasional emoji. Vary how you open — do NOT start every message with her name (use "${first}" at most once in a while).
- React to what she actually said first, then add ONE useful, specific tip — not a list of generic advice.
- When it fits, end with one short, caring follow-up question so the conversation flows. Not every message needs one.
- Never repeat the same opener or the same advice you gave in recent messages. Never say "As an AI" or describe yourself as a companion/app — just be there.
- If she asks something off-topic, answer briefly and warmly like a friend would, then gently bring it back to how she's doing.
- FORMAT: plain chat text only, under ~60 words. No headings, no labels like "Tip:" or "Follow-up question:", no markdown **bold**, no notes/parentheses about these instructions.

You are NOT a doctor: ${warnLine} Never diagnose or prescribe.
${langLine}${preferencesBlock(mother)}`;

  const history = await recentChat(mother.id, 12);
  // Strong model with quality guard + fast fallback (lib/ai.ts) — a reply always goes out.
  let reply = (await aiComplete({
    temperature: 0.7,
    max_tokens: 260,
    messages: [
      { role: "system", content: system },
      ...history.map((h) => ({ role: h.role as "user" | "assistant", content: h.content })),
      { role: "user", content: userText },
    ],
  })) || "I'm right here with you, mama 🌸";
  reply = toChatText(reply); // WhatsApp/Telegram formatting (no **markdown**)

  // Yoruba: the brain answers in English, then HelpMum's open-source translator
  // renders it in fluent Yoruba (en→yo is the reliable direction). Falls back to
  // the English reply if the translator is unavailable.
  if (useYoTranslator) {
    const yo = await toYoruba(reply);
    if (yo) reply = yo;
  }
  try {
    await saveChat(mother.id, "user", userText, week);
    await saveChat(mother.id, "assistant", reply, week);
  } catch (e) {
    console.error("whatsapp chat save error:", e);
  }
  return reply;
}
