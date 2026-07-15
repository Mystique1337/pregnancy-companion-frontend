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

// Primary client + model (MamaBot when deployed, else NVIDIA). Existing call sites
// keep using these unchanged — they just get the HelpMum brain automatically.
export const ai = mamabot || nvidia;
export const AI_MODEL = mamabot ? MAMABOT_MODEL : NVIDIA_MODEL;

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

// Non-streaming completion for the chat brains (WhatsApp/Telegram). Order:
//   MamaBot (if deployed, quality-guarded) → STRONG NVIDIA model (20s budget)
//   → fast 8B fallback — so a reply always goes out, and it's never junk.
export async function aiComplete(
  params: Omit<OpenAI.Chat.ChatCompletionCreateParamsNonStreaming, "model" | "stream">
): Promise<string> {
  const run = async (client: OpenAI, model: string, timeout?: number) => {
    const r = await client.chat.completions.create(
      { ...params, messages: withModelQuirks(model, params.messages), stop: CHAT_STOPS, model, stream: false },
      timeout ? { timeout } : undefined
    );
    return cleanReply(r.choices?.[0]?.message?.content || "");
  };
  if (mamabot) {
    try {
      const out = await run(mamabot, MAMABOT_MODEL);
      if (!looksBad(out)) return out;
      console.warn("[ai] MamaBot output rejected (low quality) — falling back to NVIDIA");
    } catch (e) {
      console.warn("[ai] MamaBot failed, falling back to NVIDIA:", e instanceof Error ? e.message : e);
    }
  }
  try {
    // 14s budget: nemotron typically answers in 4-8s; beyond that the fast 8B
    // fallback keeps the chat snappy instead of leaving her staring at "typing…".
    const out = await run(nvidia, NVIDIA_MODEL_STRONG, 14000);
    if (out && !looksBad(out)) return out;
    console.warn("[ai] strong model output rejected — falling back to fast model");
  } catch (e) {
    console.warn("[ai] strong model failed, falling back to fast model:", e instanceof Error ? e.message : e);
  }
  return run(nvidia, NVIDIA_MODEL);
}
