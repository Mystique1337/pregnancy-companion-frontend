// Prepare chat text for text-to-speech: strip emojis, markdown markers and other
// symbols so the voice never reads out "smiling face" or "asterisk". Shared by the
// server voice (SoroTTS), WhatsApp/Telegram voice notes, and the on-device voice.
export function stripForSpeech(text: string): string {
  return (text || "")
    // emoji + pictographs, incl. variation selectors, ZWJ sequences, keycaps
    .replace(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}\u{20E3}\u{1F3FB}-\u{1F3FF}]/gu, " ")
    // markdown / chat markers that engines read aloud
    .replace(/[*_`#~]/g, " ")
    .replace(/^\s*[•●-]\s*/gm, "")
    // stray artifacts
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([,.!?])/g, "$1")
    .trim();
}
