import OpenAI from "openai";

// Two OpenAI-compatible brains:
//  • MamaBot  — HelpMum's open-source maternal LLM (mamabot-llama-1) on Modal.
//               PREFERRED when MAMABOT_URL is set. This satisfies the hackathon's
//               open-source requirement and grounds answers in HelpMum's training.
//  • NVIDIA   — default + automatic fallback so the demo never dies (MamaBot on
//               Modal scales to zero, so its first call after idle can cold-start).
//
// Fallback apiKeys so the clients construct at import even before env is set
// (otherwise `next build` page-data collection throws).

const nvidia = new OpenAI({
  apiKey: process.env.NVIDIA_API_KEY || "not-configured",
  baseURL: process.env.NVIDIA_BASE_URL || "https://integrate.api.nvidia.com/v1",
});
const NVIDIA_MODEL = process.env.NVIDIA_MODEL || "meta/llama-3.1-8b-instruct";
// The conversational brain. 49B Nemotron is dramatically warmer/smarter than the 8B
// (measured ~3.6s vs 1.5s — fine for chat) and handles Pidgin/code-switching well.
// The 8B stays as the fast fallback so a reply always goes out.
const NVIDIA_MODEL_STRONG = process.env.NVIDIA_MODEL_STRONG || "nvidia/llama-3.3-nemotron-super-49b-v1";
export const AI_MODEL_STRONG = NVIDIA_MODEL_STRONG;

// Small models happily hallucinate the next "User:" turn — cut generation there.
export const CHAT_STOPS = ["\nUser:", "\nAssistant:", "\nBumply:"];

// Post-process a model reply: drop leaked dialogue turns, reasoning blocks, meta
// commentary and stray role labels so a mother never sees "User: ..." or
// "(Note: as per the guidelines...)" inside a message.
export function cleanReply(text: string): string {
  let t = (text || "").trim();
  t = t.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();          // nemotron reasoning blocks
  const leak = t.search(/\n\s*(User|Assistant|Bumply|Her)\s*:/i);   // hallucinated next turns
  if (leak > 0) t = t.slice(0, leak).trim();
  t = t.replace(/^\s*(Assistant|Bumply)\s*:\s*/i, "");              // leading role label
  // Meta commentary about its own instructions, e.g. "(Note: ... guidelines ...)"
  // or a trailing "*Note:* here is the revised version: ..." self-edit block.
  t = t.replace(/\(\s*Note:[\s\S]*?\)\s*/gi, "").trim();
  const metaAt = t.search(/\n\s*[*_(]*\s*Note\s*[:*)]/i);
  if (metaAt > 0) t = t.slice(0, metaAt).trim();
  // The model sometimes wraps the whole reply in quotation marks — unwrap them.
  const open = t[0];
  if ((open === '"' || open === "“" || open === "'") && t.length > 2) {
    const close = open === "“" ? "”" : open;
    if (t.endsWith(close)) t = t.slice(1, -1).trim();
    else if (!t.slice(1).includes(open)) t = t.slice(1).trim(); // lone leading quote
  }
  return t.trim();
}

// WhatsApp/Telegram don't render **markdown** — map it to their native *bold* and
// strip heading/label syntax so replies read like a human typed them.
export function toChatText(text: string): string {
  return (text || "")
    .replace(/\*\*(.+?)\*\*/g, "*$1*")   // **bold** → *bold*
    .replace(/^#{1,4}\s*/gm, "")          // markdown headings
    .replace(/^[-•]\s*/gm, "• ")          // normalise bullets
    .trim();
}

// The model ROLE-REVERSING — speaking as the anxious mother and asking HER for
// advice ("Do you have any advice for me? How are you coping?") — is the worst
// failure mode a mother can see. Detect it so we never send it.
export function looksReversed(text: string): boolean {
  const t = (text || "").toLowerCase();
  const q = (t.match(/\?/g) || []).length;
  if (q >= 4) return true; // interrogation, not conversation
  const reversed = /(advice|guidance|wisdom) (would be|for me)|do you have any (advice|tips) (for me)?|how are you coping|i'?m (feeling|just feeling) (a bit |quite |really )?(overwhelmed|anxious|stressed|out)/;
  return reversed.test(t) && q >= 2;
}

// Hard ceiling on chat replies: at most `maxSentences` sentences and ~`maxWords`
// words, always ending on a complete sentence — no mid-sentence max_token cuts.
export function enforceChatBrevity(text: string, maxSentences = 3, maxWords = 60): string {
  const t = (text || "").trim();
  if (!t) return t;
  const sentences = t.match(/[^.!?…]+[.!?…]+["')\]]*\s*/g) || [t];
  let out = "";
  let count = 0;
  for (const s of sentences) {
    if (count >= maxSentences) break;
    if ((out + s).split(/\s+/).length > maxWords && count > 0) break;
    out += s;
    count++;
  }
  out = out.trim();
  // If the source had no sentence ending at all (pure mid-cut), drop the dangling tail.
  if (!/[.!?…]["')\]]*$/.test(out)) {
    const lastStop = Math.max(out.lastIndexOf("."), out.lastIndexOf("!"), out.lastIndexOf("?"));
    if (lastStop > 20) out = out.slice(0, lastStop + 1);
  }
  return out || t.split(/\s+/).slice(0, maxWords).join(" ");
}

// Nemotron models take a "detailed thinking" toggle as the first system line.
function withModelQuirks(model: string, messages: OpenAI.Chat.ChatCompletionMessageParam[]): OpenAI.Chat.ChatCompletionMessageParam[] {
  if (/nemotron/i.test(model)) return [{ role: "system", content: "detailed thinking off" }, ...messages];
  return messages;
}

const MAMABOT_URL = process.env.MAMABOT_URL;
const MAMABOT_MODEL = process.env.MAMABOT_MODEL || "mamabot";
const mamabot = MAMABOT_URL
  ? new OpenAI({ apiKey: process.env.MAMABOT_KEY || "not-configured", baseURL: MAMABOT_URL })
  : null;

export const usingMamabot = !!mamabot;

// NVIDIA ONLY for all text generation (user decision 2026-07-16). MamaBot stays
// deployed on Modal purely as open-source provenance — never in the reply path.
export const ai = nvidia;
export const AI_MODEL = NVIDIA_MODEL;

// Explicit fallback handle.
export const aiFallback = nvidia;
export const AI_MODEL_FALLBACK = NVIDIA_MODEL;

// mamabot-llama-1 is an under-documented fine-tune whose output can be forum-scrape
// noise ("1 doctor agreed with this answer…", heavy repetition). Reject those so we
// never show a mother junk — fall back to NVIDIA instead.
function looksBad(text: string): boolean {
  const t = (text || "").trim();
  if (t.length < 15) return true;
  if (/doctor agreed with this answer|healthtap|icliniq|^share\b/i.test(t)) return true;
  const lines = t.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  if (lines.length >= 3 && new Set(lines).size <= Math.ceil(lines.length / 2)) return true; // repetitive
  const words = t.toLowerCase().split(/\s+/);
  if (words.length > 12 && new Set(words).size / words.length < 0.5) return true; // low lexical variety
  return false;
}

// Non-streaming completion for the chat brains (WhatsApp/Telegram).
// ONE MODEL ONLY — the strong NVIDIA nemotron (user decision 2026-07-16): the 8B
// "fallback" produced rambling, role-reversed replies, so it is banned from chat.
// One retry on the SAME model; quality-guarded (junk + role-reversal). Returns ""
// when nemotron can't produce a good reply — callers send their own safe line.
export async function aiComplete(
  params: Omit<OpenAI.Chat.ChatCompletionCreateParamsNonStreaming, "model" | "stream">
): Promise<string> {
  const run = async (timeout: number) => {
    const r = await nvidia.chat.completions.create(
      { ...params, messages: withModelQuirks(NVIDIA_MODEL_STRONG, params.messages), stop: CHAT_STOPS, model: NVIDIA_MODEL_STRONG, stream: false },
      { timeout }
    );
    return cleanReply(r.choices?.[0]?.message?.content || "");
  };
  for (const [attempt, timeout] of [[1, 35000], [2, 30000]] as const) { // NVIDIA from Railway can queue; bots show typing, so patience beats the fallback line
    try {
      const out = await run(timeout);
      if (out && !looksBad(out) && !looksReversed(out)) return out;
      console.warn(`[ai] nemotron output rejected (attempt ${attempt})`);
    } catch (e) {
      console.warn(`[ai] nemotron failed (attempt ${attempt}):`, e instanceof Error ? e.message : e);
    }
  }
  return ""; // caller sends its safe fallback line
}
