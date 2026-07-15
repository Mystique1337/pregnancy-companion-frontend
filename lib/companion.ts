import { aiComplete } from "./ai";
import type { Mother } from "./queries";
import { getWeeklyUpdateByWeek, recentChat, saveChat, recentJournalSummary } from "./queries";
import { currentWeekFrom, trimesterFor } from "./babyData";
import { languageInstruction } from "./languages";
import { groundingBlock } from "./rag";
import { preferencesBlock } from "./personalize";

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

  const system = `You are Bumply, a warm, caring AI pregnancy companion, chatting with ${mother.full_name} over WhatsApp.
She is in week ${week} (${trimesterFor(week)} trimester)${mother.due_date ? `, due ${mother.due_date}` : ""}. First pregnancy: ${
    mother.first_pregnancy ? "yes" : "no"
  }. Dietary notes: ${mother.dietary_restrictions || "none"}. ${context}${journalBlock}${groundingBlk}
Reply like a caring friend on WhatsApp: warm, brief (1–3 short sentences), an occasional emoji, and use her first name sometimes. Give practical, trimester-appropriate guidance. BE CONCISE — no preamble or filler, get straight to the helpful point.
You are NOT a doctor: for any warning signs (heavy bleeding, severe or persistent pain, reduced fetal movement, fever, vision changes, severe swelling), clearly and gently urge her to contact her healthcare provider or go to a clinic. Never diagnose or prescribe.
${languageInstruction(mother.language || "en")}${preferencesBlock(mother)}`;

  const history = await recentChat(mother.id, 12);
  // Prefers HelpMum's MamaBot, auto-falls back to NVIDIA so a WhatsApp chat never breaks.
  const reply = (await aiComplete({
    temperature: 0.7,
    max_tokens: 400,
    messages: [
      { role: "system", content: system },
      ...history.map((h) => ({ role: h.role as "user" | "assistant", content: h.content })),
      { role: "user", content: userText },
    ],
  })) || "I'm right here with you, mama 🌸";
  try {
    await saveChat(mother.id, "user", userText, week);
    await saveChat(mother.id, "assistant", reply, week);
  } catch (e) {
    console.error("whatsapp chat save error:", e);
  }
  return reply;
}
