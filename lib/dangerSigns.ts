// Deterministic danger-sign detection for WhatsApp/SMS messages. Runs on the
// mother's own words (English + Nigerian Pidgin) BEFORE the AI, so a red flag
// always gets a fast, correct, urgent response — never left to the model. This is
// the impact core: shorten "symptom → seek care".

export type DangerLevel = "emergency" | "urgent";
export type DangerHit = { level: DangerLevel; sign: string };

type Rule = { sign: string; level: DangerLevel; any: RegExp[]; not?: RegExp[] };

// NOTE: native-language (Yoruba/Hausa/Igbo) terms below are ADDITIVE — they only
// widen detection, never narrow it, so they cannot create new false-negatives. Only
// high-confidence, distinctive words are used (with ASCII word boundaries) to avoid
// false positives. No lookbehind, so the regex runs on old Android WebViews too.
const RULES: Rule[] = [
  { sign: "fits/convulsions", level: "emergency", any: [/\bconvuls/i, /\bseizure/i, /\bfits\b/i, /having.*fit/i, /jerk(ing)?\b/i, /body.*(shak|jerk)/i, /\bgiri\b/i, /wárápá|\bwarapa\b/i, /farfad/i, /jijiji/i] },
  { sign: "heavy bleeding", level: "emergency", any: [/heavy.*(bleed|blood)/i, /soak.*(pad|cloth)/i, /pass(ing)?\s+clot/i, /plenty\s+blood/i, /blood.*(comot|rush)/i, /(ẹjẹ|\beje\b|\bjini\b|ọbara|\bobara\b).*(pọ̀|púpọ̀|plenty|comot|rush)/i] },
  { sign: "vaginal bleeding", level: "urgent", any: [/\bbleed/i, /\bblood\b/i, /dey\s+see\s+blood/i, /dey\s+bleed/i, /spotting/i, /ẹjẹ/i, /\beje\b/i, /\bjini\b/i, /ọbara/i, /\bobara\b/i], not: [/blood\s*pressure/i, /\bbp\b/i, /blood\s*sugar/i, /nose\s*bleed/i] },
  { sign: "baby not moving", level: "urgent", any: [/baby.*(not|no|never|stop|isn.?t|less).*(mov|kick)/i, /pikin.*(no|never).*(mov|kick)/i, /no.*(movement|kicking)/i, /not.*feel.*baby/i, /reduced.*movement/i, /baby.*(quiet|still)/i] },
  { sign: "waters broken", level: "urgent", any: [/water.*(break|broke|burst|comot|don\s*come|leak)/i, /my\s+water/i, /fluid.*(leak|comot|rush)/i] },
  { sign: "vision changes (pre-eclampsia)", level: "urgent", any: [/blur(red|ry)?\s*(vision|eye)?/i, /can.?t\s+see\s+well/i, /see\s+double/i, /flashing\s+light/i, /spots?\s+(in|before).*eye/i, /eye.*(dey\s+)?blur/i] },
  { sign: "sudden swelling (face/hands)", level: "urgent", any: [/(face|hand|finger).*(swell|swollen|puff)/i, /swell.*(face|hand)/i, /my\s+face.*swell/i] },
  { sign: "severe abdominal pain", level: "urgent", any: [/severe.*(pain|cramp)/i, /(belle|belly|tummy|stomach|abdomen).*(pain).*(bad|severe|well\s*well|too\s*much)/i, /strong\s+(belle|belly)\s+pain/i, /pain.*(no\s+dey\s+stop|constant)/i] },
  { sign: "difficulty breathing / chest pain", level: "emergency", any: [/can.?t\s+breath/i, /hard.*to.*breath/i, /breathless/i, /chest.*pain/i, /short(ness)?\s+of\s+breath/i, /no\s+fit\s+breath/i, /breath.*(hard|difficult)/i] },
  { sign: "fainting / collapse", level: "urgent", any: [/faint/i, /pass(ed)?\s+out/i, /collaps/i, /black\s*out/i, /dizzy.*fall/i] },
  { sign: "high fever", level: "urgent", any: [/high\s+fever/i, /fever.*(high|bad|hot)/i, /body.*(hot).*(well|too|very)/i, /39\s*°?c/i, /40\s*°?c/i, /\biba\b|ibà/i, /zazzab/i, /ahụ\s*ọkụ|ahu\s*oku/i] },

  // --- Postpartum (after birth) danger signs for the mother ---
  { sign: "foul-smelling discharge (infection)", level: "urgent", any: [/(discharge|lochia|blood|comot for down).*(smell|foul|stink|odou?r)/i, /(smell|foul).*(discharge|down there)/i] },
  { sign: "painful/swollen breast with fever (mastitis)", level: "urgent", any: [/breast.*(red|hot|hard|swollen|lump).*(fever|pain|hot)/i, /(mastitis)/i] },

  // --- Newborn danger signs (baby just born) ---
  { sign: "newborn: not breathing / fast or hard breathing", level: "emergency", any: [/baby.*(not|no|stop|can.?t|hard\s*to).*breath/i, /baby.*(breath.*(fast|hard|quick)|fast\s*breath|grunt)/i, /pikin.*(no|hard).*breath/i, /newborn.*breath/i] },
  { sign: "newborn: cold, floppy or won't wake", level: "emergency", any: [/baby.*(cold|floppy|limp|won.?t\s*wake|not\s*waking|unconscious|not\s*respond)/i, /pikin.*(cold|no\s*dey\s*wake)/i] },
  { sign: "newborn: not feeding / refusing breast", level: "urgent", any: [/baby.*(not|no|refus|won.?t|stop|can.?t).*(feed|suck|breast|latch)/i, /pikin.*(no\s*dey|refuse).*(suck|breast|chop)/i] },
  { sign: "newborn: yellow skin or eyes (jaundice)", level: "urgent", any: [/baby.*(yellow|jaundice)/i, /(baby|pikin).*(eye|skin).*yellow/i, /(eye|skin).*(dey\s*)?yellow/i] },
  { sign: "newborn: fever or body too hot/cold", level: "urgent", any: [/baby.*(fever|hot|high\s*temp|too\s*cold)/i, /pikin.*(body\s*hot|fever)/i] },
  { sign: "newborn: cord bleeding, smelling or with pus", level: "urgent", any: [/(cord|navel|belly\s*button).*(bleed|smell|pus|red|swollen|discharge)/i] },
];

export function detectDangerSign(text: string): DangerHit | null {
  const t = String(text || "").toLowerCase();
  if (!t.trim()) return null;
  let best: DangerHit | null = null;
  for (const r of RULES) {
    if (r.not && r.not.some((n) => n.test(t))) continue;
    if (r.any.some((a) => a.test(t))) {
      if (!best || (r.level === "emergency" && best.level !== "emergency")) best = { level: r.level, sign: r.sign };
    }
  }
  return best;
}

// The urgent reply, in simple English + Pidgin so a low-literacy mother gets it fast.
export function dangerReply(firstName: string, hit: DangerHit): string {
  const name = firstName || "mama";
  const baby = hit.sign.startsWith("newborn:");
  if (hit.level === "emergency") {
    if (baby) return `🚨 ${name}, your baby need help NOW. Carry am go the nearest hospital immediately — no wait at all.\n\nKeep the baby warm on your chest (skin to skin) while you dey go. Make somebody follow you.\n\n(This na safety warning, no be diagnosis.)`;
    return `🚨 ${name}, this can be very serious. Abeg, GO to the nearest hospital NOW — no wait.\n\nIf you fit, make somebody follow you. I don tell your health worker.\n\n(This na safety warning, no be diagnosis.)`;
  }
  if (baby) return `⚠️ ${name}, your baby need to see a health worker today — no wait for am to worse.\n\nKeep the baby warm and keep trying to breastfeed small small. If baby stop breathing well, go floppy, or no dey wake, rush to hospital NOW.\n\nI don also alert your health worker. (Safety info, no be diagnosis.)`;
  return `⚠️ ${name}, this one need checking today. Please go to your clinic or nearest hospital before evening — no wait for am to worse.\n\nWatch for: plenty bleeding, bad belle pain, baby wey no dey move, or eye wey dey blur — if any happen, go hospital NOW.\n\nI don also alert your health worker. (Safety info, no be diagnosis.)`;
}
