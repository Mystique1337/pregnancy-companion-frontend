import { ai, AI_MODEL_STRONG, CHAT_STOPS } from "@/lib/ai";
import { resolveModel } from "@/lib/settings";
import { getSession } from "@/lib/session";
import { getMotherById, getWeeklyUpdateByWeek, recentChat, saveChat, recentJournalSummary } from "@/lib/queries";
import { currentWeekFrom, trimesterFor } from "@/lib/babyData";
import { languageInstruction } from "@/lib/languages";
import { detectMessageLanguage } from "@/lib/detectLang";
import { groundingWithSources } from "@/lib/rag";
import { preferencesBlock, toneMaxTokens } from "@/lib/personalize";

function textResponse(body: string, status = 200) {
  return new Response(body, { status, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return textResponse("Please sign in to chat with Bumply.", 401);

  const mother = await getMotherById(session.sub);
  if (!mother) return textResponse("Account not found.", 404);

  if (mother.plan !== "premium") {
    return textResponse(
      "Chatting with me one-on-one is a premium feature, mama 🌸 Upgrade your plan and I'll be here any time, day or night, with answers tailored to exactly where you are."
    );
  }

  const body = await req.json().catch(() => ({}));
  const incoming: { role: string; content: string }[] = Array.isArray(body.messages) ? body.messages : [];
  const lastUser = [...incoming].reverse().find((m) => m.role === "user")?.content?.trim() || "";

  const week = currentWeekFrom({ dueDate: mother.due_date, enteredWeek: mother.current_week, createdAt: mother.created_at });
  const update = await getWeeklyUpdateByWeek(mother.id, week);
  const context = update ? `This week's focus: ${update.baby_development || ""}. Affirmation: ${update.affirmation || ""}.` : "";
  const journal = await recentJournalSummary(mother.id, 5);
  const journalBlock = journal ? `\nHer recent journal check-ins (reference these naturally if relevant):\n${journal}` : "";

  // RAG: retrieve vetted facts relevant to her question to ground the answer.
  const { block: grounding, sources } = await groundingWithSources(lastUser, 4);
  const groundingPrompt = grounding
    ? `\nVERIFIED REFERENCE (vetted guidance — rely on this, do not contradict it; if it doesn't cover the question, answer carefully from general knowledge and suggest she ask her provider):\n${grounding}`
    : "";

  const first = (mother.full_name || "mama").split(" ")[0];
  const system = `You are Bumply — ${first}'s pregnancy companion. Think of yourself as her sharp, warm Nigerian friend who happens to know maternal health inside out: a bit of an auntie, a bit of a midwife, never a robot.
She is in week ${week} (${trimesterFor(week)} trimester)${
    mother.due_date ? `, due ${mother.due_date}` : ""
  }. First pregnancy: ${mother.first_pregnancy ? "yes" : "no"}. Dietary notes: ${mother.dietary_restrictions || "none"}. ${context}${journalBlock}${groundingPrompt}

HOW YOU TALK (STRICT):
- SHORT. 1–3 short sentences, 35 words MAX — like a real chat message. Only go longer if she explicitly asks for details.
- Mirror her energy. Playful gets playful. Worried gets calm and warm.
- React to what she said, then at most ONE specific tip. Never a list. Never two tips.
- At most ONE question per message — and only when it helps. No stacked questions.
- Vary your openers; don't start every message with her name (use "${first}" rarely).
- Never repeat advice you already gave. Never say "As an AI". Never describe yourself.
- FORMAT: plain text only. No headings, no *labels*, no bullet lists, no notes about these rules, never wrap the reply in quotes.

You are NOT a doctor: for any warning signs (heavy bleeding, severe or persistent pain, reduced fetal movement, fever, vision changes, severe swelling), gently and clearly urge her to contact her healthcare provider or go to a clinic. Never diagnose or prescribe.
${languageInstruction(detectMessageLanguage(lastUser) || mother.language || "en")}${preferencesBlock(mother)}`;

  const history = await recentChat(mother.id, 16);
  // First-ever conversation → Bumply introduces itself and discovers her needs.
  const systemFinal = history.length <= 1
    ? system + `\nFIRST CONVERSATION: say who you are in a few words (e.g. "I'm Bumply 🌸"), answer what she said, and ask ONE short question about what she needs most. Whole reply still 3 sentences max. Never introduce yourself again after this.`
    : system;

  // Strong model first (best conversation quality); admin override via settings;
  // fast 8B retry if the strong stream fails to start.
  const model = await resolveModel(AI_MODEL_STRONG); // NVIDIA only (user decision)
  const startStream = (m: string) =>
    ai.chat.completions.create({
      model: m,
      temperature: 0.7,
      max_tokens: Math.min(toneMaxTokens(mother, 600), 300),
      stream: true,
      stop: CHAT_STOPS,
      messages: [
        ...(/nemotron/i.test(m) ? [{ role: "system" as const, content: "detailed thinking off" }] : []),
        { role: "system" as const, content: systemFinal },
        ...history.map((h) => ({ role: h.role as "user" | "assistant", content: h.content })),
        { role: "user" as const, content: lastUser },
      ],
    });
  let stream;
  try {
    stream = await startStream(model);
  } catch (e) {
    console.error("chat start error, retrying same model:", e);
    try {
      stream = await startStream(model); // ONE model only — never the 8B
    } catch (e2) {
      console.error("chat start error:", e2);
      return textResponse("I couldn't reach my thoughts just now — please try again in a moment. 🌸");
    }
  }

  const encoder = new TextEncoder();
  const rs = new ReadableStream<Uint8Array>({
    async start(controller) {
      // A closed controller (client gone / proxy timeout) must never crash the route.
      const safe = (s: string) => { try { controller.enqueue(encoder.encode(s)); } catch { /* closed */ } };
      // Heartbeat: flush an invisible byte IMMEDIATELY — with zero bytes sent, the
      // proxy kills slow-first-token streams with a 502 before the model speaks.
      safe("​");
      let full = "";
      try {
        for await (const part of stream) {
          const tok = part.choices?.[0]?.delta?.content || "";
          if (tok) {
            full += tok;
            safe(tok);
          }
        }
      } catch (e) {
        console.error("chat stream error:", e);
        safe("\n\n(Sorry mama, I lost my train of thought — please try again. 🌸)");
      }
      // Cite the vetted sources the answer drew on (once).
      if (full.trim() && sources.length && !full.includes("📚")) {
        const foot = `\n\n📚 ${sources.join(" · ")}`;
        safe(foot);
        full += foot;
      }
      try { controller.close(); } catch { /* already closed */ }
      try {
        if (lastUser) await saveChat(mother.id, "user", lastUser, week);
        if (full.trim()) await saveChat(mother.id, "assistant", full.trim(), week);
      } catch (e) {
        console.error("chat save error:", e);
      }
    },
  });

  return new Response(rs, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
}
