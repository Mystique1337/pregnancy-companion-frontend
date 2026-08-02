// Deterministic danger-sign detection for WhatsApp/Telegram messages. Runs on the
// mother's own words (English, Nigerian Pidgin, Yorùbá, Hausa, Igbo) BEFORE the AI,
// so a red flag always gets a fast, correct, urgent response — never left to a model.
// This is the impact core: shorten "symptom → seek care".
//
// Measured, not asserted: `npm run eval:danger` scores this against a labelled
// benchmark (data/danger-benchmark.jsonl) and reports sensitivity/specificity per
// language. Sensitivity is prioritised — a missed danger sign can be fatal, a false
// alarm costs a clinic visit. Change nothing here without re-running that harness.

export type DangerLevel = "emergency" | "urgent";
export type DangerHit = { level: DangerLevel; sign: string };

type Rule = {
  sign: string;
  level: DangerLevel;
  any: RegExp[];
  not?: RegExp[];
  /** Unmistakable phrasings that BEAT the `not` guards — a distractor elsewhere in
   *  the message ("my bp was fine … and now I am seeing blood") must never veto a
   *  symptom she is actually reporting. */
  override?: RegExp[];
};

/**
 * Lowercase and strip TONE marks while KEEPING the dot-below (U+0323), because the
 * dot is what distinguishes ẹ from e and ọ from o in Yorùbá/Igbo. Without this,
 * "ẹ̀jẹ̀" (blood, fully marked) never matched the pattern "ẹjẹ" — which is why
 * Yorùbá sensitivity measured 33%.
 */
function norm(s: string): string {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀́̂̄̆̌]/g, "")
    .normalize("NFC");
}

/** Match two ideas near each other in EITHER order — real messages don't follow
 *  our word order ("swollen face" vs "face is swelling", "foul smelling lochia"). */
const near = (a: string, b: string) => new RegExp(`(?:${a}[\\s\\S]{0,40}${b}|${b}[\\s\\S]{0,40}${a})`, "i");

// Words that mean the message is ABOUT a baby, used to break ties toward the
// newborn rules — otherwise "my baby has fever" replied with advice about HER.
const BABY_CTX = /\b(baby|babies|newborn|new born|infant|pikin|nwa|jariri|jaririn|ọmọ|omo)\b/i;

// Narrow, safe suppressors. Deliberately NOT suppressing "is it normal…" — a mother
// asking "is it normal to see blood?" IS reporting bleeding and must still flag.
const NOT_HERS_NOW = [
  /\b(last|previous)\s+(year|month|pregnancy)\b/i,
  /\b\d+\s+years?\s+ago\b/i,
  /\bwhen i was\b/i,
  /\bi\s+(dey\s+)?fear\s+(say|that|of)\b/i,
  /\bi\s+(read|heard|saw)\s+(about|on|for|say|that|in)\b/i,
  /\bwhat\s+if\b/i,
  /\bused\s+to\b/i,
  /^\s*does\s+\w+\s+\w+/i,
];
const EXPLICIT_NEGATION = [
  /\bno\s+(fever|bleeding|blood|pain|smell|discharge)\b/i,
  /\bnot\s+(bleeding|swollen|hot)\b/i,
  /\bdidn'?t\s+(faint|bleed)\b/i,
  /\bnever\s+bleed\b/i,
];

// In Nigerian languages "blood" is overwhelmingly used for ANAEMIA and nutrition
// ("food that gives blood"), not haemorrhage. The English guards for this existed;
// the Yorùbá/Hausa/Igbo ones did not — which is exactly why native-language
// specificity measured far worse than English. These apply to BOTH bleeding rules.
const BLOOD_NOT_BLEEDING: RegExp[] = [
  /blood\s*pressure/i, /\bbp\b\s*(is|was|:|=)?\s*\d/i, /blood\s*sugar/i, /nose\s*bleed/i,
  /blood\s*(tonic|level|test|group|count|work|donat)/i,
  /(low|shortage\s+of|lack\s+of|little)\s+blood/i,
  /(give|gives|build|builds|boost|boosts|increase|raise|add)\s+(my\s+|me\s+)?blood/i,
  /gum(s)?\s*(are|dey|is)?\s*bleed/i, /bleeding\s*gums?/i,
  near("(nose|nostril|imu)", "(blood|bleed|jini|ẹjẹ)"),
  /blood\s+(on|for)\s+(the\s+)?(meat|fish|chicken|food|floor)/i,
  // "what can I eat to increase my blood" — a diet question, not a haemorrhage.
  near("(ẹjẹ|\\beje\\b|\\bjini\\b|ọbara|\\bobara\\b)", "(kara|pọ\\s*si|po\\s*si|baa|increase|build|boost|add|raise)"),
  /(kini|ki ni|gịnị|gini|wanne|which|what)[^.!?]{0,40}(\bjẹ\b|\bje\b|\beri\b|abinci|chop|eat|food)/i,
];

// A few contexts are so clearly not-a-symptom that they beat even the override
// list (which exists so a distractor can't veto a real symptom).
const HARD_VETO: RegExp[] = [
  /blood\s+(on|for|inside)\s+(the\s+)?(meat|fish|chicken|food|floor|cloth)/i,
  near("(nose|nostril|imu)", "(blood|bleed)"),
];

const RULES: Rule[] = [
  { sign: "fits/convulsions", level: "emergency",
    any: [/\bconvuls/i, /\bseizure/i, /\b(had|has|having|get|got|dey get|is getting)\s+fits\b/i, /having.*fit/i,
          /body.*(shak|jerk)/i, /\bgiri\b/i, /\bwarapa\b/i, /farfad/i, /jijiji/i],
    not: [/\bfits\s+(me|her|well|fine|perfectly)\b/i, near("shak", "(cold|bath|water|fear|hungry|laugh|generator)")] },

  { sign: "heavy bleeding", level: "emergency",
    any: [/heavy.*(bleed|blood)/i, /soak.*(pad|cloth|wrapper)/i, /pass(ing)?\s+clot/i, /plenty\s+blood/i,
          /blood.*(comot|rush|gush|pour)/i, /bleeding\s+(a\s+lot|too\s+much|heavily|well\s*well)/i,
          near("(ẹjẹ|\\beje\\b|\\bjini\\b|ọbara|\\bobara\\b)", "(pọ|pupọ|plenty|comot|rush|yawa|jade|zubar)")],
    not: BLOOD_NOT_BLEEDING },

  // "blood" needs bleeding CONTEXT — a bare \bblood\b hijacked ordinary chat about
  // blood tonic / low blood (anaemia) / blood tests with a frightening urgent reply.
  { sign: "vaginal bleeding", level: "urgent",
    any: [/\bbleed/i,
          /(see|seeing|dey\s+see|saw|notice[ds]?|pass(ing)?|comot|wipe[ds]?)\s+(some\s+|small\s+)?blood/i,
          /(there\s+(was|is)|i\s+(saw|see|notice))\s+(some\s+|small\s+)?blood/i,
          /blood\s+(when|after)\s+i\b/i,
          /blood\s+(dey\s+)?(comot|come\s*out|drop|flow|rush)/i,
          /blood\s+(for|on|in)\s+(my\s+)?(pant|underwear|toilet|tissue|wrapper)/i,
          /spotting/i, /ẹjẹ/i, /\beje\b/i, /\bjini\b/i, /ọbara/i, /\bobara\b/i, /zubar\s*da\s*jini/i],
    override: [/\bi\s+(am|'m|dey|don)\s+bleed/i, /bleeding[^.!?]{0,20}(won'?t|will not|no dey|not)\s*stop/i,
               /\bspotting\b/i, /blood\s+(for|on|in)\s+(my\s+)?(pant|underwear)/i,
               /(there\s+(was|is)|i\s+(am\s+)?(saw|see|seeing))\s+(some\s+|small\s+)?blood/i,
               /now\s+i\s+am\s+seeing\s+blood/i],
    not: BLOOD_NOT_BLEEDING },

  { sign: "baby not moving", level: "urgent",
    any: [/baby.*(not|no|never|stop|isn.?t|less|reduce).*(mov|kick)/i,
          /(pikin|nwa|jariri|ọmọ).*(no|never|not).*(mov|kick|motsi)/i,
          /\bno\b[^.!?]{0,20}(movement|kick)/i,
          /(haven'?t|have not|has not|hasn'?t|not)\s+felt?\s+(any\s+)?(kick|movement|baby)/i,
          /(movement|kicking)[^.!?]{0,20}(reduce|less|stop|slow)/i,
          /reduced.*movement/i, /ba\s+ya\s+motsi/i, /kò\s*yi|ko\s*yi\s*padà|ko yi pada/i,
          /(baby|pikin|nwa|ọmọ|omo)[^.!?]{0,25}\b(quiet|calm)\b/i],
    not: [/(moving|kicking)\s+(well|fine|a lot|non\s*stop|plenty)/i, /still\s+(moving|kicking)/i, /very\s+active/i] },

  { sign: "waters broken", level: "urgent",
    any: [/water.*(break|broke|burst|comot|don\s*come|leak)/i,
          /my\s+water\s+(don\s+)?(break|broke|burst|comot|leak)/i,
          /fluid.*(leak|comot|rush)/i, /ruwa.*(fashe|zube)/i, near("omi", "(bu|jade)")],
    not: [/(bottle|tank|tap|bag|pipe|sachet|pure\s+water|bucket|roof|house)/i] },

  { sign: "vision changes (pre-eclampsia)", level: "urgent",
    any: [/blur\w*\s+(vision|eye|sight)/i, /(vision|eye|sight)\w*[^.!?]{0,15}\bblur/i,
          /can.?t\s+see\s+well/i, /(see|seeing)\s+double/i, /everything\s+looks?\s+double/i,
          /flashing\s+light/i, /spots?\s+(in|before).*eye/i,
          /anya[^.!?]{0,20}(ọchịchịrị|ochichiri)/i, /ido\s*mi.*ṣu|oju mi.*ṣu/i],
    not: [/(charger|phone|bulb|nepa|generator|screen|torch|lamp)/i] },

  { sign: "severe headache (pre-eclampsia)", level: "urgent",
    any: [/(severe|bad|terrible|worst|serious|strong|heavy)\s+head\s*ache/i,
          /head\s*ache[^.!?]{0,40}(panadol|paracetamol|not\s+go|no\s+dey\s+go|won'?t\s+go|since\s+(morning|yesterday)|two\s+days)/i,
          /head\s+(dey\s+)?(bang|beat|split|knock|hammer)/i,
          /worst\s+headache/i, /ciwon\s*kai/i, /isi\s+na-?awa/i, /ori\s*mi\s*n?\s*(fọ|fo|dun)/i],
    not: [/(mild|small|slight|little)\s+head/i] },

  { sign: "sudden swelling (face/hands)", level: "urgent",
    any: [near("(face|hand|finger|cheek|fuska|hannu|oju|ojú|ọwọ)", "(swell|swollen|puff|kumbura|\\bwu\\b)"),
          /my\s+face.*swell/i],
    not: [/(mosquito|insect|bite|sting|boil|pimple|injection|rash)/i] },

  { sign: "severe abdominal pain", level: "urgent",
    any: [/severe.*(pain|cramp)/i,
          near("(belle|belly|tummy|stomach|abdomen|afọ|ciki|inu)", "(pain|ache|hurt|egbu|ciwo|dun)"),
          /strong\s+(belle|belly)\s+pain/i, /pain.*(no\s+dey\s+stop|constant|wont stop|won'?t stop)/i],
    not: [/(mild|small|slight|little)\s+(pain|cramp)/i, /pain\s+me\s+small/i,
          /(tooth|teeth|dental|ear|throat|back|leg|waist)\s*(ache|pain)/i,
          near("(pain|ache)", "(tooth|teeth|dental|ear|throat)")] },

  { sign: "difficulty breathing / chest pain", level: "emergency",
    any: [/can.?t\s+breath/i, /hard.*to.*breath/i, /breathless/i, /chest.*pain/i, near("chest", "(pain|hurt|tight|dun)"),
          /short(ness)?\s+of\s+breath/i, /no\s+fit\s+breath/i, /breath.*(hard|difficult)/i,
          near("numfashi", "(ciwo|wahala|fama)"), /iku\s*ume/i, /mi\s*o\s*le\s*mi/i],
    not: [/(climb|stairs|walk|exercise|trek)[^.!?]{0,45}(settle|rest|stop|better)/i, /small\s+breathless/i] },

  { sign: "fainting / collapse", level: "urgent",
    any: [/\b(i|she|he|my wife)\s+(just\s+|almost\s+|nearly\s+)?faint(ed|ing)?\b/i, /\bfainting\b/i,
          /\b(i|she|he)\s+\w{0,8}\s*(pass(ed)?\s+out|black(ed)?\s*out)/i,
          /(going|about)\s+to\s+(pass\s+out|faint|black\s*out)/i,
          /\b(i|she|he)\s+(just\s+)?collaps/i, /dizzy.*fall/i, /adara\s*m\s*n'?ala/i],
    not: [/faint\s+(line|smell|sound|light|mark)/i, /(nepa|light|power|generator|phone|network)\s*(don\s*)?(black|go)/i] },

  { sign: "high fever", level: "urgent",
    any: [/high\s+fever/i, /fever.*(high|bad|hot)/i, /body.*(hot).*(well|too|very)/i,
          /\b(3[89]|4[01])(\.\d)?\s*(°\s*)?(c\b|celsius|degree)/i,
          /temperatur\w*\s+(is|was|na|dey)?\s*(3[89]|4[01])/i,
          /\biba\b/i, /zazzab/i, near("ahụ|ahu", "(ọkụ|oku)")] },

  // --- Postpartum (after birth) danger signs for the mother ---
  { sign: "foul-smelling discharge (infection)", level: "urgent",
    any: [near("(discharge|lochia|down\\s*there|comot for down)", "(smell|foul|stink|odou?r|rùn|run)"),
          /(discharge|lochia)[^.!?]{0,25}smell/i,
          near("(comot|come\\s*out)[^.!?]{0,15}(for\\s*)?my\\s*down", "smell"),
          /wey\s+dey\s+comot[^.!?]{0,30}smell/i] },
  { sign: "painful/swollen breast with fever (mastitis)", level: "urgent",
    any: [near("breast", "(red|hot|hard|swollen|lump)"), /(mastitis)/i] },

  // --- Newborn danger signs (the baby, not the mother) ---
  { sign: "newborn: not breathing / fast or hard breathing", level: "emergency",
    any: [/(baby|newborn|pikin|nwa|jariri\w*).*(not|no|stop|can.?t|hard\s*to).*breath/i,
          /(baby|newborn|pikin|jariri\w*).*(breath.*(fast|hard|quick)|fast\s*breath|grunt)/i,
          near("(jariri\\w*|baby|newborn)", "numfashi\\s*(da\\s*)?(sauri|sosai)")] },
  { sign: "newborn: cold, floppy or won't wake", level: "emergency",
    any: [/(baby|newborn|pikin|nwa|jariri\w*).*(cold|floppy|limp|won.?t\s*wake|not\s*waking|unconscious|not\s*respond|naghị\s*eteta)/i,
          near("(nwa|baby|newborn)", "(ajụ\\s*oyi|aju oyi)")],
    not: [/(room|water|weather|bath|night|floor)\s*(is\s*)?cold/i] },
  { sign: "newborn: not feeding / refusing breast", level: "urgent",
    any: [/(baby|newborn|pikin|nwa|jariri\w*).*(not|no|refus|won.?t|stop|can.?t).*(feed|suck|breast|latch|ọmụ|omu)/i,
          /(pikin|baby).*(no\s*dey|refuse).*(suck|breast|chop)/i,
          near("(ọmọ|omo)\\s*mi", "(ko\\s*mu|kò\\s*mu)")],
    not: [/feed(ing|s)?\s+(well|fine|ok|good)/i] },
  { sign: "newborn: yellow skin or eyes (jaundice)", level: "urgent",
    any: [/(baby|newborn|pikin|nwa|jariri\w*).*(yellow|jaundice|rawaya)/i,
          /(baby|pikin|newborn).*(eye|skin).*yellow/i, /(eye|skin).*(dey\s*)?yellow/i,
          near("jaririn", "rawaya")] },
  { sign: "newborn: fever or body too hot/cold", level: "urgent",
    any: [/(baby|newborn|pikin|jariri\w*).*(fever|hot|high\s*temp|too\s*cold)/i,
          /(pikin|baby).*(body\s*hot|fever)/i, near("(nwa|ọmọ)\\s*m", "(ọkụ|oku|ekpo)")] },
  { sign: "newborn: cord bleeding, smelling or with pus", level: "urgent",
    any: [near("\\b(cord|navel|belly\\s*button|ìdodo|idodo|cibiya)\\b", "(bleed|smell|pus|red|swollen|discharge|run|pọn|pon)")] },
];

export function detectDangerSign(text: string): DangerHit | null {
  const raw = String(text || "");
  if (!raw.trim()) return null;
  const t = norm(raw);

  // She's recounting someone else's history, a fear, or something she read —
  // not reporting a symptom happening to her now.
  if (NOT_HERS_NOW.some((p) => p.test(t)) || EXPLICIT_NEGATION.some((p) => p.test(t))) return null;

  const babyCtx = BABY_CTX.test(t);
  let best: DangerHit | null = null;
  for (const r of RULES) {
    if (HARD_VETO.some((v) => v.test(t))) continue;
    const strong = r.override?.some((o) => o.test(t)) ?? false;
    if (!strong && r.not?.some((n) => n.test(t))) continue;
    if (!r.any.some((a) => a.test(t))) continue;

    const isNewborn = r.sign.startsWith("newborn:");
    if (
      !best ||
      (r.level === "emergency" && best.level !== "emergency") ||
      // When she's clearly talking about her BABY, a newborn rule must win the tie —
      // otherwise dangerReply() gave her advice about herself while her baby was sick.
      (r.level === best.level && babyCtx && isNewborn && !best.sign.startsWith("newborn:"))
    ) {
      best = { level: r.level, sign: r.sign };
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
