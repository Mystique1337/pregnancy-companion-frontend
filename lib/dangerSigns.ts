// Deterministic danger-sign detection for WhatsApp/SMS messages. Runs on the
// mother's own words (English + Nigerian Pidgin) BEFORE the AI, so a red flag
// always gets a fast, correct, urgent response — never left to the model. This is
// the impact core: shorten "symptom → seek care".

export type DangerLevel = "emergency" | "urgent";
export type DangerHit = { level: DangerLevel; sign: string };

type Rule = { sign: string; level: DangerLevel; any: RegExp[]; not?: RegExp[] };

const RULES: Rule[] = [
  { sign: "fits/convulsions", level: "emergency", any: [/\bconvuls/i, /\bseizure/i, /\bfits\b/i, /having.*fit/i, /jerk(ing)?\b/i, /body.*(shak|jerk)/i] },
  { sign: "heavy bleeding", level: "emergency", any: [/heavy.*(bleed|blood)/i, /soak.*(pad|cloth)/i, /pass(ing)?\s+clot/i, /plenty\s+blood/i, /blood.*(comot|rush)/i] },
  { sign: "vaginal bleeding", level: "urgent", any: [/\bbleed/i, /\bblood\b/i, /dey\s+see\s+blood/i, /dey\s+bleed/i, /spotting/i], not: [/blood\s*pressure/i, /\bbp\b/i, /blood\s*sugar/i, /nose\s*bleed/i] },
  { sign: "baby not moving", level: "urgent", any: [/baby.*(not|no|never|stop|isn.?t|less).*(mov|kick)/i, /pikin.*(no|never).*(mov|kick)/i, /no.*(movement|kicking)/i, /not.*feel.*baby/i, /reduced.*movement/i, /baby.*(quiet|still)/i] },
  { sign: "waters broken", level: "urgent", any: [/water.*(break|broke|burst|comot|don\s*come|leak)/i, /my\s+water/i, /fluid.*(leak|comot|rush)/i] },
  { sign: "vision changes (pre-eclampsia)", level: "urgent", any: [/blur(red|ry)?\s*(vision|eye)?/i, /can.?t\s+see\s+well/i, /see\s+double/i, /flashing\s+light/i, /spots?\s+(in|before).*eye/i, /eye.*(dey\s+)?blur/i] },
  { sign: "sudden swelling (face/hands)", level: "urgent", any: [/(face|hand|finger).*(swell|swollen|puff)/i, /swell.*(face|hand)/i, /my\s+face.*swell/i] },
  { sign: "severe abdominal pain", level: "urgent", any: [/severe.*(pain|cramp)/i, /(belle|belly|tummy|stomach|abdomen).*(pain).*(bad|severe|well\s*well|too\s*much)/i, /strong\s+(belle|belly)\s+pain/i, /pain.*(no\s+dey\s+stop|constant)/i] },
  { sign: "difficulty breathing / chest pain", level: "emergency", any: [/can.?t\s+breath/i, /hard.*to.*breath/i, /breathless/i, /chest.*pain/i, /short(ness)?\s+of\s+breath/i, /no\s+fit\s+breath/i, /breath.*(hard|difficult)/i] },
  { sign: "fainting / collapse", level: "urgent", any: [/faint/i, /pass(ed)?\s+out/i, /collaps/i, /black\s*out/i, /dizzy.*fall/i] },
  { sign: "high fever", level: "urgent", any: [/high\s+fever/i, /fever.*(high|bad|hot)/i, /body.*(hot).*(well|too|very)/i, /39\s*°?c/i, /40\s*°?c/i] },
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
  if (hit.level === "emergency") {
    return `🚨 ${name}, this can be very serious. Abeg, GO to the nearest hospital NOW — no wait.\n\nIf you fit, make somebody follow you. I don tell your health worker.\n\n(This na safety warning, no be diagnosis.)`;
  }
  return `⚠️ ${name}, this one need checking today. Please go to your clinic or nearest hospital before evening — no wait for am to worse.\n\nWatch for: plenty bleeding, bad belle pain, baby wey no dey move, or eye wey dey blur — if any happen, go hospital NOW.\n\nI don also alert your health worker. (Safety info, no be diagnosis.)`;
}
