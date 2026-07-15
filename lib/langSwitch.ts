// Let a mother change her chat language from INSIDE the conversation (WhatsApp or
// Telegram) — "speak yoruba", "change language to hausa", "/language pidgin", or
// simply "/language" to see the options. The stored language drives AI replies,
// the UI, and which SoroTTS voice speaks to her.

export const LANG_NAMES: Record<string, string> = {
  en: "English", pcm: "Pidgin", yo: "Yorùbá", ha: "Hausa", ig: "Igbo",
};

const NAME_TO_CODE: Record<string, string> = {
  english: "en", en: "en",
  pidgin: "pcm", pcm: "pcm", naija: "pcm", "broken english": "pcm",
  yoruba: "yo", "yorùbá": "yo", yo: "yo",
  hausa: "ha", ha: "ha",
  igbo: "ig", ibo: "ig", ig: "ig",
};

// Confirmation sent IN the newly chosen language, teaching her she can switch again.
export const LANG_CONFIRM: Record<string, string> = {
  en: "✓ Done! We'll chat in English now. (You can change any time — just say \"speak Pidgin\", \"speak Yoruba\", \"speak Hausa\" or \"speak Igbo\".)",
  pcm: "✓ Don set! Na Pidgin we go dey yarn now. (You fit change am any time — just talk \"speak English\" or the language wey you want.)",
  yo: "✓ Ó ti ṣetán! A máa bá ọ sọ̀rọ̀ ní Yorùbá báyìí. (O lè yí i padà nígbàkúgbà — kàn sọ \"speak English\" tàbí èdè tí o fẹ́.)",
  ha: "✓ An gama! Za mu tattauna da Hausa yanzu. (Kina iya canzawa kowane lokaci — ki ce \"speak English\" ko harshen da kike so.)",
  ig: "✓ Emeela! Anyị ga na-akparịta ụka n'Igbo ugbu a. (Ị nwere ike ịgbanwe mgbe ọ bụla — kwuo \"speak English\" ma ọ bụ asụsụ ị chọrọ.)",
};

export const LANG_MENU =
  "🌍 Which language should we chat in? Reply with one:\n• English\n• Pidgin\n• Yorùbá (yoruba)\n• Hausa\n• Igbo\n\nExample: speak yoruba";

const NAME_PATTERN = "(english|pidgin|pcm|naija|broken english|yoruba|yorùbá|hausa|igbo|ibo)";
const SWITCH_RE = new RegExp(
  `(?:^\\/?(?:language|lang)\\s+${NAME_PATTERN}\\s*$)` + // "/language yoruba" | "language hausa"
  `|(?:\\b(?:speak|talk|reply(?:\\s+to\\s+me)?|chat|yarn|answer)(?:\\s+(?:in|for|with|to me in))?\\s+${NAME_PATTERN}\\b)` + // "speak yoruba", "reply in hausa"
  `|(?:\\b(?:change|switch)\\s+(?:my\\s+)?(?:language|lang)(?:\\s+to)?\\s+${NAME_PATTERN}\\b)`, // "change language to igbo"
  "i"
);

// "/language" or "language" alone → show the menu.
export function isLanguageMenuRequest(text: string): boolean {
  return /^\/?(language|lang)\s*$/i.test((text || "").trim());
}

// Returns the new language code if the message is a language-change request, else null.
export function detectLanguageChange(text: string): string | null {
  const t = (text || "").trim();
  if (!t || t.length > 80) return null; // long messages aren't commands
  const m = t.match(SWITCH_RE);
  if (!m) return null;
  const name = (m[1] || m[2] || m[3] || "").toLowerCase();
  return NAME_TO_CODE[name] ?? null;
}
