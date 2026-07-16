// Detect the language a message is written in (en/pcm/yo/ha/ig) so Bumply replies
// in the language she ACTUALLY used — not just her stored profile default.
// Conservative by design: returns null unless confident (≥2 points), so short or
// ambiguous messages fall back to her saved language.

const MARKERS: Record<string, string[]> = {
  pcm: ["wetin", "abeg", "dey", "una", "wahala", "sabi", "comot", "waka", "oya", "shey", "abi", "belle", "how far", "no fit", "don born", "make i", "make we", "well well", "sharp sharp", "yarn"],
  yo: ["bawo", "ekaaro", "ekaasan", "ekurole", "pele", "kini", "ojoojumo", "oyun", "omo mi", "mo fe", "mo ni", "mo n", "dara", "jowo", "e se", "ese o", "ara mi"],
  ha: ["sannu", "ina", "yaya", "nagode", "na gode", "lafiya", "kina", "zan", "gobe", "yau", "ciki", "jariri", "madalla", "don allah", "yanzu", "haihuwa"],
  ig: ["kedu", "biko", "daalu", "ndewo", "gini", "afo ime", "ime m", "nwa m", "otu a", "ka m", "na-eme", "na-enye"],
};

// Script-level signals (strong): Yoruba uses ẹ/ṣ (+ tone-marked vowels); Igbo uses ị/ụ/ṅ.
const YO_CHARS = /[ẹṣ́̀]/iu;
const IG_CHARS = /[ịụṅ]/iu;

export type DetectedLang = "en" | "pcm" | "yo" | "ha" | "ig";

export function detectMessageLanguage(text: string): DetectedLang | null {
  const raw = (text || "").toLowerCase();
  if (raw.trim().length < 3) return null;
  // Normalise: strip punctuation so "wetin?" still matches, pad with spaces.
  const t = " " + raw.replace(/[^\p{L}\p{M}\s'-]/gu, " ").replace(/\s+/g, " ").trim() + " ";
  const scores: Record<string, number> = { pcm: 0, yo: 0, ha: 0, ig: 0 };
  for (const [lang, words] of Object.entries(MARKERS)) {
    for (const w of words) {
      const needle = w.includes(" ") ? w : ` ${w} `;
      if (t.includes(needle)) scores[lang] += 1;
    }
  }
  if (YO_CHARS.test(text)) scores.yo += 2;
  if (IG_CHARS.test(text)) scores.ig += 2;
  const best = (Object.entries(scores) as [DetectedLang, number][]).sort((a, b) => b[1] - a[1])[0];
  return best[1] >= 2 ? best[0] : null; // not confident → caller uses her stored language
}
