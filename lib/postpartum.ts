// Detect when a mother tells us (over WhatsApp) that she has given birth, so we can
// switch her into postpartum mode: newborn danger-sign awareness + the free
// immunization schedule. Keep the trigger tight to avoid false positives.
const BIRTH = [
  /\bi\s*(have|'?ve)?\s*(just\s*)?(given\s*birth|delivered|had\s*(my|the)\s*baby)/i,
  /\bbaby\s*(is\s*)?(born|arrived|don\s*come)/i,
  /\bbaby\s*(has|have)\s*(come|arrived)/i,
  /\bi\s*don\s*(born|deliver|put\s*to\s*bed)/i,
  /\bi\s*put\s*to\s*bed/i,
  /\bmy\s*baby\s*(don|has|have)\s*come/i,
  /\bwe\s*(have\s*)?welcomed\s*(our|the)\s*baby/i,
];

// Future-tense / question phrasing that mentions birth but is NOT an announcement
// ("when will my baby come?", "when is baby due?").
const NOT_YET = /\b(when|will|going\s+to|go\s+come|due|expect|should\s+i)\b/i;

// Only fire on a genuinely short, announcement-style message (not a question or a
// long message that merely mentions birth).
export function detectBirthAnnouncement(text: string): boolean {
  const t = String(text || "").trim();
  if (!t || t.length > 120) return false;
  if (t.includes("?") || NOT_YET.test(t)) return false;
  return BIRTH.some((r) => r.test(t));
}

export function birthCongratsReply(name: string, firstVisit: string): string {
  const who = name || "mama";
  return `🎉 Congratulations, ${who}! Welcome to your new baby. 💛\n\nI'll now help you both. Two important things:\n\n1️⃣ *Watch the baby* — if the baby is not breathing well, too cold or floppy, not feeding, or the skin/eyes turn yellow, get to a hospital fast.\n\n2️⃣ *Free immunization* — ${firstVisit}\n\nYou can message me any time about feeding, the cord, your own healing, or the baby's health.`;
}
