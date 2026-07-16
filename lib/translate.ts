// HelpMum's open-source English<->Yoruba translators (M2M100) served on Modal.
// Used to give a genuine, HelpMum-powered Yoruba layer: her Yoruba in → English →
// answer → Yoruba out. Gated on TRANSLATE_URL; every call fails soft (returns null)
// so callers fall back to the model's own Yoruba.
const URL = process.env.TRANSLATE_URL || "";
const KEY = process.env.TRANSLATE_KEY || process.env.MAMABOT_KEY || "";

export function translatorConfigured(): boolean {
  return !!URL;
}

type Direction = "en2yo" | "en2ha" | "en2ig" | "yo2en" | "ha2en" | "ig2en";

async function call(direction: Direction, text: string): Promise<string | null> {
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

// Generic helpers — HelpMum's eng↔9ja models cover Yorùbá, Hausa AND Igbo.
export const TRANSLATABLE = ["yo", "ha", "ig"] as const;
export type TranslatableLang = (typeof TRANSLATABLE)[number];
export const isTranslatable = (code: string): code is TranslatableLang =>
  (TRANSLATABLE as readonly string[]).includes(code);
export const toLang = (code: TranslatableLang, text: string) => call(`en2${code}` as Direction, text);
export const fromLang = (code: TranslatableLang, text: string) => call(`${code}2en` as Direction, text);
