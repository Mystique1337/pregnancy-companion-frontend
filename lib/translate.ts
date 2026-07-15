// HelpMum's open-source English<->Yoruba translators (M2M100) served on Modal.
// Used to give a genuine, HelpMum-powered Yoruba layer: her Yoruba in → English →
// answer → Yoruba out. Gated on TRANSLATE_URL; every call fails soft (returns null)
// so callers fall back to the model's own Yoruba.
const URL = process.env.TRANSLATE_URL || "";
const KEY = process.env.TRANSLATE_KEY || process.env.MAMABOT_KEY || "";

export function translatorConfigured(): boolean {
  return !!URL;
}

async function call(direction: "en2yo" | "yo2en", text: string): Promise<string | null> {
  if (!URL || !text.trim()) return null;
  try {
    const r = await fetch(URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: KEY, direction, text: text.slice(0, 1000) }),
      cache: "no-store",
      signal: AbortSignal.timeout(60000),
    });
    if (!r.ok) return null;
    const d = await r.json().catch(() => ({}));
    return typeof d?.text === "string" && d.text.trim() ? d.text.trim() : null;
  } catch {
    return null;
  }
}

export const toYoruba = (text: string) => call("en2yo", text);
export const toEnglish = (text: string) => call("yo2en", text);
