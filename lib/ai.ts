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

// Non-streaming completion that prefers MamaBot and falls back to NVIDIA on any
// error (cold-start timeout, 5xx, etc.). Use for the WhatsApp brain so a red-flag
// conversation never breaks. Returns the reply text.
export async function aiComplete(
  params: Omit<OpenAI.Chat.ChatCompletionCreateParamsNonStreaming, "model" | "stream">
): Promise<string> {
  const run = async (client: OpenAI, model: string) => {
    const r = await client.chat.completions.create({ ...params, model, stream: false });
    return r.choices?.[0]?.message?.content?.trim() || "";
  };
  if (mamabot) {
    try {
      return await run(mamabot, MAMABOT_MODEL);
    } catch (e) {
      console.warn("[ai] MamaBot failed, falling back to NVIDIA:", e instanceof Error ? e.message : e);
    }
  }
  return run(nvidia, NVIDIA_MODEL);
}
