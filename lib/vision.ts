// Photo understanding: reads a photo a mother sends over WhatsApp (ANC card, drug
// packet, test result) and explains it simply. Uses NVIDIA's FREE vision model
// (OpenAI-compatible) — no GPU bill, no Modal. Fails soft (returns null) so the
// WhatsApp flow degrades gracefully to "please type your question".
import OpenAI from "openai";
import sharp from "sharp";
import { aiComplete } from "./ai";

const nvidia = new OpenAI({
  apiKey: process.env.NVIDIA_API_KEY || "not-configured",
  baseURL: process.env.NVIDIA_BASE_URL || "https://integrate.api.nvidia.com/v1",
});
// A free multimodal NIM model. Override with NVIDIA_VISION_MODEL if needed.
const VISION_MODEL = process.env.NVIDIA_VISION_MODEL || "meta/llama-3.2-11b-vision-instruct";

export function visionConfigured(): boolean {
  return !!process.env.NVIDIA_API_KEY;
}

const DEFAULT_PROMPT =
  "You are a kind maternal-health helper for a Nigerian mother, replying on WhatsApp. Read this photo and explain in simple English what it says. " +
  "If it is an antenatal (ANC) card, read out her key details, next visit and any results. If it is a medicine, say what it is and how to take it. " +
  "If it is a test result, say plainly whether anything looks abnormal. If you see anything worrying, tell her to see a health worker. " +
  "Be BRIEF: at most 4 short sentences, warm and simple. Do not repeat yourself, do not give long lifestyle advice, do not diagnose.";

// NVIDIA passes images inline as a base64 data URI, but caps the request size.
// Downscale + compress to comfortably fit (target ~120KB binary).
async function toDataUri(image: Buffer): Promise<string | null> {
  try {
    for (const [width, quality] of [[1100, 72], [900, 65], [700, 55], [560, 45]] as const) {
      const out = await sharp(image).rotate().resize({ width, withoutEnlargement: true }).jpeg({ quality }).toBuffer();
      if (out.length <= 125_000) return `data:image/jpeg;base64,${out.toString("base64")}`;
    }
    // Last resort: smallest attempt regardless of size.
    const out = await sharp(image).rotate().resize({ width: 480 }).jpeg({ quality: 40 }).toBuffer();
    return `data:image/jpeg;base64,${out.toString("base64")}`;
  } catch {
    return null;
  }
}

// Read an image (as a Buffer) and return a plain-language explanation, or null.
export async function readImage(image: Buffer, prompt?: string): Promise<string | null> {
  if (!visionConfigured() || !image?.length) return null;
  const dataUri = await toDataUri(image);
  if (!dataUri) return null;
  try {
    const r = await nvidia.chat.completions.create({
      model: VISION_MODEL,
      max_tokens: 240,
      temperature: 0.2,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt || DEFAULT_PROMPT },
            { type: "image_url", image_url: { url: dataUri } },
          ],
        },
      ],
    });
    const text = r.choices?.[0]?.message?.content?.trim() || "";
    return text || null;
  } catch (e) {
    console.error("vision readImage error:", e);
    return null;
  }
}

// The tiny/vision model may read values without judging them. Run the reading
// through the strong text brain to append a one-line safety caution when a value
// looks abnormal (high BP, anaemia, etc.). Fails soft to empty string.
export async function safetyNote(reading: string): Promise<string> {
  if (!reading || reading.length < 20) return "";
  try {
    const note = await aiComplete({
      temperature: 0,
      max_tokens: 80,
      messages: [
        {
          role: "system",
          content:
            "You check a reading from a pregnant/new mother's ANC card or test result for danger. " +
            "If any value is abnormal for pregnancy (blood pressure ≥140/90, PCV/haematocrit <30% or Hb <10, high blood sugar, or any clearly abnormal result), reply with ONE short sentence starting '⚠️' telling her to see a health worker about that specific value. " +
            "If nothing is clearly abnormal or there are no medical values, reply with exactly 'OK'.",
        },
        { role: "user", content: reading },
      ],
    });
    const t = (note || "").trim();
    return /^ok\b/i.test(t) || t.length < 4 ? "" : t;
  } catch {
    return "";
  }
}
