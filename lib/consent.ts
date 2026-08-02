// Consent + right-to-erasure primitives, shared by every channel (WhatsApp,
// Telegram, web). Nigeria Data Protection Act 2023: a mother's health data is
// sensitive personal data, so we take an informed, freely-given, plain-language
// consent BEFORE we start storing her conversation, and we honour "delete my
// data" the moment she asks — in her own words, in her own language.
//
// Everything here is pure (no I/O, no env, no DB) so a webhook can call it on the
// hot path, and so it can be unit-tested and reviewed line by line by a grant or
// ethics reviewer.
import { normalizeLang, type LangCode } from "./languages";

/** Stamped on every consent record (mothers.consent_version) so we can prove
 *  WHICH wording a mother agreed to. Bump this whenever the text below changes
 *  materially — mothers on an older version can then be re-asked. */
export const CONSENT_VERSION = "v1-2026-07";

// ---------------------------------------------------------------------------
// The consent notice
// ---------------------------------------------------------------------------
// Rules for this text (deliberate, not stylistic):
//  • ≤ 60 words — it has to be readable on a ₦45k phone screen in one glance.
//  • Plain text only. No markdown, no headings — WhatsApp renders ** literally.
//  • Covers the four things NDPA s.27 requires her to actually understand:
//    WHAT we keep, WHY, WHO sees it, and that she can withdraw at any time.
//  • Translations are natural, not literal — a low-literacy mother must get it.
const CONSENT_MESSAGES: Record<LangCode, string> = {
  en:
    "Hi 🌸 Before we start: I save your messages, your pregnancy week and any health notes you share. " +
    "I use them to answer you, and to alert your health worker if you are in danger. " +
    "Only your health worker sees them. Say \"delete my data\" any time and I remove everything. " +
    "Reply YES to continue.",

  pcm:
    "Hi 🌸 Before we start: I dey keep your messages, your pregnancy week, and any health talk you send. " +
    "I dey use am answer you, and alert your health worker if wahala dey. " +
    "Na only your health worker dey see am. Talk \"delete my data\" any time, I go clear everything. " +
    "Reply YES make we start.",

  yo:
    "Pẹlẹ o 🌸 Mo máa fi àwọn ọ̀rọ̀ rẹ, ọ̀sẹ̀ oyún rẹ àti ìròyìn ìlera rẹ pamọ́. " +
    "Mo fi dá ọ lóhùn, mo sì fi kìlọ̀ fún olùtọ́jú ìlera rẹ tí ewu bá wà. " +
    "Òun nìkan ni ó máa rí i. Sọ \"delete my data\" nígbàkúgbà, màá pa gbogbo rẹ̀ rẹ́. " +
    "Dáhùn YES láti bẹ̀rẹ̀.",

  ha:
    "Sannu 🌸 Ina ajiye saƙonninki, makon cikinki da duk labarin lafiyarki da kika aiko. " +
    "Ina amfani da su wajen amsa miki, da sanar da ma'aikaciyar lafiyarki idan akwai hatsari. " +
    "Ita kaɗai ce ke ganin su. Ki ce \"delete my data\" a kowane lokaci, zan share komai. " +
    "Ki amsa da YES mu fara.",

  ig:
    "Ndewo 🌸 Ana m echekwa ozi gị, izu ime gị na ihe gbasara ahụ ike gị. " +
    "Eji m ha aza gị, ma kpọtụrụ onye nlekọta ahụ ike gị ma ọ bụrụ na ihe egwu dị. " +
    "Naanị ya na-ahụ ha. Kwuo \"delete my data\" mgbe ọ bụla, m ga-ehichapụ ihe niile. " +
    "Zaa YES ka anyị malite.",
};

/** The consent notice in her language (en · pcm · yo · ha · ig). Unknown or
 *  missing language falls back to English. Safe to send as-is on WhatsApp. */
export function consentMessage(lang?: string | null): string {
  return CONSENT_MESSAGES[normalizeLang(lang)];
}

// ---------------------------------------------------------------------------
// Reading her reply
// ---------------------------------------------------------------------------

// Hausa/Igbo letters that Unicode does NOT decompose (ƙ ɗ ɓ ƴ), folded by hand so
// the matchers below can work on plain ASCII.
const LETTER_FOLD: Record<string, string> = { "ƙ": "k", "Ƙ": "k", "ɗ": "d", "Ɗ": "d", "ɓ": "b", "Ɓ": "b", "ƴ": "y", "Ƴ": "y" };

/** Lowercase, strip tone marks (Yorùbá/Igbo), drop emoji + punctuation, collapse
 *  spaces. "Ẹ̀ẹ̀ni o!! 🌸" → "eeni o". */
function normalize(text: string): string {
  return String(text || "")
    .replace(/[ƙƘɗƊɓƁƴƳ]/g, (c) => LETTER_FOLD[c] ?? c)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9'\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// An explicit refusal must NEVER be read as consent. Checked first. The lookahead
// protects Pidgin "no wahala" / "no problem", which are agreement, not refusal.
const REFUSALS: RegExp[] = [
  /^no\b(?!\s*(wahala|problem|vex|worry|shaking))/,
  /^(nope|nah|never|mba|rara|kada|a a|aa)\b/,
  /\b(do not|dont|no|never)\s+(agree|accept|consent|gree|want)\b/,
  /\bnot\s+(interested|ready|now)\b/,
];

// Whole-message affirmatives across en · pcm · yo · ha · ig. Exact match only, so
// a stray "ok" inside a long sentence can't silently create a consent record.
// NOTE: bare "i" (Hausa yes) is deliberately absent — it collides with the English
// pronoun. "eh", "ii", "to"/"toh" and "na yarda" cover Hausa instead.
const ACCEPT_EXACT: ReadonlySet<string> = new Set([
  // English
  "yes", "y", "yes please", "yes i agree", "yeah", "yea", "yep", "yup", "ok", "okay", "okey", "oky",
  "sure", "agree", "agreed", "i agree", "accept", "i accept", "i consent", "consent",
  "fine", "alright", "all right", "go ahead", "continue", "proceed", "start",
  // Nigerian Pidgin
  "yes o", "yes oo", "yes ooo", "yes now", "yes na", "yes abeg", "ok o", "okay o", "no wahala",
  "ehen", "ehn", "eh en", "na so", "oya", "oya now", "i gree", "i don gree", "make we start",
  // Yorùbá
  "beeni", "beni", "eeni", "eni", "o daa", "o da", "mo gba", "mo gba a", "mo faramo",
  // Hausa
  "eh", "ehh", "ii", "to", "toh", "na yarda", "ina yarda", "shi ke nan", "madalla", "tabbas", "kwarai",
  // Igbo
  "ee", "eeh", "ee o", "o di mma", "odi mma", "ngwa", "ekwenyere m", "a na m ekwe",
]);

// Longer replies that still clearly mean yes.
const ACCEPT_PATTERNS: RegExp[] = [
  /^(yes|yeah|yep|yup|ok|okay|sure|alright)\b/,
  /\bi\s+(agree|accept|consent)\b/,
  /\bi\s+(don\s+)?gree\b/,
  /^(mo\s+gba|mo\s+faramo)\b/,
  /^(na|ina)\s+yarda\b/,
  /^(ee+|beeni|eeni)\b/,
];

/**
 * Did she say yes? Accepts "yes", "i agree", "ok", "yes o", "eeni", "ee", "toh",
 * "ehen" and their common variants across the five languages. Biased towards NO:
 * anything ambiguous returns false and the bot simply asks again — a wrongly
 * recorded consent is far worse than one extra question.
 */
export function isConsentAccepted(text: string): boolean {
  const t = normalize(text);
  if (!t) return false;
  if (REFUSALS.some((r) => r.test(t))) return false;
  if (ACCEPT_EXACT.has(t)) return true;
  // Only look inside short replies; a paragraph containing "ok" is not consent.
  if (t.split(" ").length > 6) return false;
  return ACCEPT_PATTERNS.some((p) => p.test(t));
}

// ---------------------------------------------------------------------------
// Right to erasure (NDPA 2023, s.34) — she can ask in her own words
// ---------------------------------------------------------------------------
const DELETE_PATTERNS: RegExp[] = [
  // "delete my data", "remove my data", "erase my information", "comot my details"
  /\b(delete|remove|erase|clear|wipe|comot|cancel)\b[a-z0-9' ]{0,20}\b(data|info|information|details|record|records|account|messages?|everything|things?)\b/,
  /\bforget\s+(me|about\s+me|my\s+data)\b/,
  /\b(delete|remove)\s+me\b/,
  /\b(unsubscribe|opt\s*out|opted\s*out)\b/,
  // Needs an explicit object — a bare "stop" prefix would swallow "stop the
  // bleeding" and other things a frightened mother actually types.
  /\bstop\s+(sending|messaging|texting)\b/,
  /\bstop\s+(the\s+)?(me\s+)?(messages?|texts?|chat|sms|everything)\b/,
  // "stop" on its own is the universal opt-out keyword — exact match only, so
  // "stop, my belle dey pain" still reaches the danger-sign checker.
  /^stop( it| now| please| bumply| am| me)?$/,
  // Yorùbá / Hausa / Igbo — distinctive words only, so they can only widen the net.
  /\bpa\b[a-z0-9' ]{0,10}\bdata\b/,
  /\bgbagbe\s+mi\b/,
  /^duro$/,
  /\bshare\s+(bayana|bayanai|bayanaina|bayanina|duk|komai)\b/,
  /^tsaya$/,
  /\bhichap/,
  /\bchefuo\s+m\b/,
  /^kwusi$/,
];

/**
 * Is she asking us to erase her data? Recognises "delete my data", "forget me",
 * "stop", "remove my data" and close variants in en/pcm/yo/ha/ig. A false positive
 * is cheap: the caller replies with DELETE_CONFIRM_MESSAGE and nothing is erased
 * until she confirms.
 */
export function isDeleteRequest(text: string): boolean {
  const t = normalize(text);
  if (!t) return false;
  return DELETE_PATTERNS.some((p) => p.test(t));
}

/** The two-step guard: erasure is irreversible, so she must type DELETE. */
export const DELETE_CONFIRM_MESSAGE =
  "Are you sure? If I delete your data I lose your messages, your week and your health notes, " +
  "and your health worker will not see them any more. This cannot be undone.\n\n" +
  "Reply DELETE to confirm. Reply anything else and nothing changes.";

/** Did she type the confirmation word? (Second step of the erasure flow.) */
export function isDeleteConfirmed(text: string): boolean {
  const t = normalize(text);
  return /^(yes\s+)?delete( it| my data| my account| everything)?$/.test(t);
}

/** Sent after eraseMotherData() succeeds — closes the loop for her, kindly. */
export const DELETE_DONE_MESSAGE =
  "Done 🌸 I have deleted your messages, your notes and your details. " +
  "Nothing about you is left for me or your health worker to see.\n\n" +
  "If you ever want me again, just message me and we start fresh. Take care of yourself.";
