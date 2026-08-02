// "Forward it to Bumply" — the WhatsApp misinformation checker. A mother forwards
// the rumour her aunt dropped in the family group ("drink salt water to bring
// labour") and gets a plain verdict in her language, in seconds.
//
// Curated Nigerian myths are matched FIRST: free, instant, and the same rumour
// always gets the same answer — a model that argues with itself on health claims
// is worse than no checker. The AI only sees rumours we have never met.
//
// Every path fails soft: when we are not confident we return null and the caller
// answers her normally. Telling a worried mother that her own question is a rumour
// is the expensive mistake, so the detectors are deliberately conservative.

import { readFile } from "node:fs/promises";
import path from "node:path";
import { aiComplete } from "./ai";
import { isTranslatable, toLang } from "./translate";

export type MisinfoVerdict = "false" | "true" | "careful";
export type MisinfoResult = { verdict: MisinfoVerdict; reply: string; claim: string; matchedMyth?: string };

type Myth = { claim: string; verdict: MisinfoVerdict; keywords: string[]; explanation: string };
type MythPack = { version: number; note?: string; items: Myth[] };

// ---------------------------------------------------------------- myth pack ---

const EMPTY: MythPack = { version: 0, items: [] };

let cache: MythPack | null = null;
let inflight: Promise<MythPack> | null = null;

function isMyth(x: unknown): x is Myth {
  const m = x as Myth | null;
  return (
    !!m &&
    typeof m.claim === "string" &&
    typeof m.explanation === "string" &&
    Array.isArray(m.keywords) &&
    (m.verdict === "false" || m.verdict === "true" || m.verdict === "careful")
  );
}

// Read from DISK, never over HTTP: this runs inside the WhatsApp webhook where
// there is no reliable origin to fetch from and a self-fetch can deadlock a
// single-worker deploy. Cached for the life of the process (the pack is static).
async function loadMyths(): Promise<MythPack> {
  if (cache) return cache;
  if (!inflight) {
    inflight = (async () => {
      let pack: MythPack = EMPTY;
      try {
        const file = path.join(process.cwd(), "public", "offline", "maternal-myths.json");
        const data = JSON.parse(await readFile(file, "utf8")) as Partial<MythPack>;
        const items = Array.isArray(data?.items) ? data.items.filter(isMyth) : [];
        pack = { version: Number(data?.version) || 1, note: data?.note, items };
      } catch (e) {
        // Cache the failure too — otherwise a missing file means a disk miss on
        // every single message. The AI fallback still works.
        console.warn("[misinfo] myth pack unavailable:", e instanceof Error ? e.message : e);
      }
      cache = pack;
      return pack;
    })();
  }
  return inflight;
}

// ------------------------------------------------------------- text helpers ---

const STOP = new Set([
  "the", "a", "an", "is", "are", "was", "were", "be", "been", "am", "it", "its", "this", "that", "these", "those",
  "and", "or", "but", "if", "so", "for", "of", "to", "in", "on", "at", "by", "with", "from", "as", "than", "then",
  "i", "me", "my", "you", "your", "we", "our", "she", "her", "he", "his", "they", "them", "their",
  "do", "does", "did", "can", "will", "would", "should", "could", "have", "has", "had", "what", "how", "why", "when",
  "who", "which", "not", "no", "yes", "all", "any", "some", "one", "two", "very", "too", "also", "just", "dey", "una",
]);

function normalize(s: string): string {
  return String(s || "").toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
}

function tokens(s: string): string[] {
  return normalize(s).split(" ").filter((w) => w.length > 2 && !STOP.has(w));
}

// Light plural stemmer so "scans harm"/"causes" in her message still hit the
// curated keyword "scan harm"/"cause". Applied to BOTH sides, so it can never
// collide two words asymmetrically — and it stays away from short words.
function stemWord(w: string): string {
  if (w.length > 4 && w.endsWith("ies")) return `${w.slice(0, -3)}y`;
  if (w.length > 3 && w.endsWith("s") && !w.endsWith("ss") && !w.endsWith("us")) return w.slice(0, -1);
  return w;
}

function stemText(s: string): string {
  return normalize(s).split(" ").map(stemWord).join(" ");
}

// WhatsApp and Telegram render * and # literally, so they must never leave here.
function plain(s: string): string {
  return String(s || "")
    .replace(/[*#`_]+/g, "")
    .replace(/\[(.+?)\]\((.+?)\)/g, "$1")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

const wordCount = (s: string) => (s.trim() ? s.trim().split(/\s+/).length : 0);

// Keep whole sentences up to `budget` words; hard-trim only if sentence one alone
// blows the budget, so she never reads half a health instruction.
function clampWords(text: string, budget: number): string {
  const t = plain(text);
  if (wordCount(t) <= budget) return t;
  const sentences = t.match(/[^.!?…]+[.!?…]+/g) || [t];
  let out = "";
  for (const s of sentences) {
    if (out && wordCount(out + s) > budget) break;
    out += s;
  }
  out = out.trim();
  if (out) return out;
  return t.split(/\s+/).slice(0, budget).join(" ").replace(/[,;:]$/, "") + ".";
}

// --------------------------------------------------------- request detection ---

// Explicit "check this for me" asks, English and Pidgin. Strong markers stand
// alone; weak ones ("check this") only count when a claim rides along.
const ASK_STRONG: RegExp[] = [
  /^\s*\/check\b/i,
  /\bis\s+(this|that|it|dis)\s+(really\s+|even\s+)?(true|correct|real|right|fake|a\s+lie)\b/i,
  /\bis\s+it\s+true\s+that\b/i,
  /\btrue\s+or\s+false\b/i,
  /\bhow\s+true\s+is\b/i,
  /\bna\s+true\b/i,
  /\bna\s+lie\b/i,
  /\babi\s+na\s+(true|lie)\b/i,
  /\bshey\s+(na\s+)?(true|e\s+true)\b/i,
  /\bfact[-\s]?check/i,
  /\b(true|correct)\s+abi\b/i,
];
const ASK_WEAK: RegExp[] = [
  /\bcheck\s+(this|dis|am|it|for\s+me)\b/i,
  /\b[ei]\s+be\s+like\s+say\b/i,
  /\bconfirm\s+(this|if|whether)\b/i,
  /\bis\s+this\s+message\b/i,
];

export function isFactCheckRequest(text: string): boolean {
  const t = String(text || "");
  if (!t.trim()) return false;
  if (ASK_STRONG.some((r) => r.test(t))) return true;
  return ASK_WEAK.some((r) => r.test(t)) && normalize(t).length >= 25;
}

// Someone else's words: an explicit forward header or an attribution.
const FORWARD_MARKERS: RegExp[] = [
  /\bforwarded\b/i,
  /\bforward(ed)?\s+(many\s+times|as\s+received)\b/i,
  /\bas\s+received\b/i,
  /\b(pls|please|abeg)\s+(forward|share|broadcast|pass)\b/i,
  /\bshare\s+(this\s+)?(to|with)\s+(all|every|your|any)\b/i,
  /\bsend\s+(this\s+)?to\s+(all|every)\b/i,
  /\bbroadcast\s+message\b/i,
  /\bcopied\s+(from|message)\b/i,
];
const RUMOUR_MARKERS: RegExp[] = [
  /\bthey\s+say\b/i,
  /\bi\s+(heard|hear)\b/i,
  /\bpeople\s+(say|dey\s+say|talk\s+say)\b/i,
  /\b(dem|them)\s+(say|talk\s+say)\b/i,
  /\b(my\s+)?(mother|mama|aunt|auntie|sister|neighbou?r|elders?|mother\s*[- ]?in\s*[- ]?law)\s+(said|say|told|dey\s+say)\b/i,
  /\bsomeone\s+(sent|posted|shared|told)\b/i,
  /\bin\s+(my|our|the)\s+(family|church|mosque|whatsapp|women)\s+group\b/i,
  /\bdoctors?\s+(don'?t|do\s+not|no\s+dey)\s+want\s+you\s+to\s+know\b/i,
  /\bnobody\s+(will|go)\s+tell\s+you\b/i,
  /\bthey\s+(are\s+)?hiding\b/i,
];
// Absolutist language is how rumours talk; real advice hedges.
const ABSOLUTE_MARKERS: RegExp[] = [
  /\bnever\s+(do|use|take|eat|drink|give|allow|go)\b/i,
  /\bmust\s+not\b/i,
  /\bdo\s+not\s+ever\b/i,
  /\bwill\s+kill\b/i,
  /\bcauses?\b/i,
  /\balways\b/i,
  /\bcure[sd]?\b/i,
  /\b100\s*%/,
  /\bguarantee[ds]?\b/i,
  /\bmiracle\b/i,
  /\bsecret\b/i,
  /\bevery\s+(pregnant\s+)?woman\s+(must|should|need)\b/i,
];
// Imperative health instruction, e.g. "Boil the leaves and drink it every night".
const ADVICE = /\b(drink|take|use|apply|rub|eat|avoid|stop|boil|mix|soak|chew|swallow|insert|tie|throw\s+away|never\s+give)\b/i;
// Keeps the checker on our subject: we do not fact-check fuel prices.
const MATERNAL =
  /\b(pregnan|labou?r|womb|belle|belly|baby|babies|newborn|breast|breastfeed|breastmilk|milk|blood|deliver|delivery|caesar|c[-\s]?section|\bcs\b|scan|ultrasound|antenatal|\banc\b|vaccin|immuni|injection|midwife|clinic|hospital|miscarr|contracept|family\s+planning|malaria|herb|agbo|womanhood|fertil|conceiv)/i;
// Her own voice — first person, or a question about herself.
const SELF_VOICE =
  /\b(i\s*am|i'?m|am\s+i|i\s+feel|i\s+dey|i\s+don|i\s+have|i\s+want|i\s+need|should\s+i|can\s+i|what\s+(should|can|do)\s+i|how\s+(do|can)\s+i|please\s+help\s+me|my\s+(baby|belle|belly|body|back|leg|head|breast|doctor|husband|period)\b)/i;

/** Heuristic: does this message look like a forwarded claim/rumour rather than her own question? */
export function looksLikeForwardedClaim(text: string): boolean {
  const t = String(text || "").trim();
  if (t.length < 60) return false; // her own quick messages are short; rumours are not

  const attributed = FORWARD_MARKERS.some((r) => r.test(t)) || RUMOUR_MARKERS.some((r) => r.test(t));
  // "Forwarded" / "they say" is the clearest evidence the words are not hers.
  if (attributed && MATERNAL.test(t)) return true;

  // The other classic forward: the whole thing pasted inside quotes.
  const quoted = /^["'“”«]/.test(t) && /["'“”»]\s*$/.test(t);
  if (quoted && t.length > 90 && MATERNAL.test(t)) return true;

  // Everything below is inference, so bail the moment she is talking about
  // herself. A missed check costs one ordinary reply; a false positive tells a
  // worried mother her own question is a rumour.
  if (SELF_VOICE.test(t)) return false;
  if (t.length <= 90) return false;
  if (!MATERNAL.test(t)) return false;

  const absolutes = ABSOLUTE_MARKERS.filter((r) => r.test(t)).length;
  const advice = ADVICE.test(t);
  const breaks = (t.match(/[.!?…\n]/g) || []).length; // multi-sentence broadcast shape

  if (absolutes >= 2) return true;
  if (absolutes >= 1 && advice) return true;
  if (breaks >= 2 && advice) return true;
  return false;
}

// ------------------------------------------------------------ claim cleanup ---

// Strip the wrapper she typed around the rumour so we classify the CLAIM, not her
// question ("is this true? drinking salt water brings labour" → the salt water bit).
const WRAPPERS: RegExp[] = [
  /^\s*\/check\b[\s:,-]*/i,
  /\bforwarded\s+(many\s+times|message)?\b/gi,
  /\bas\s+received\b/gi,
  /\b(please|pls|abeg)\s+(forward|share|broadcast|pass)\s+(this\s+)?(to|with)?\s*(all|every|your)?\b/gi,
  /\bis\s+(this|that|it|dis)\s+(really\s+|even\s+)?(true|correct|real|right|fake|a\s+lie)\b\s*\??/gi,
  /\bis\s+it\s+true\s+that\b/gi,
  /\btrue\s+or\s+false\b\s*\??/gi,
  /\bhow\s+true\s+is\s+(this|it|that)\b\s*\??/gi,
  /\b(abi\s+)?na\s+(true|lie)\b\s*\??/gi,
  /\bshey\s+(na\s+)?(true|e\s+true)\b\s*\??/gi,
  /\bfact[-\s]?check\s*(this|it)?\b\s*\??/gi,
  /\bcheck\s+(this|dis|am|it)\s*(for\s+me)?\b\s*\??/gi,
  /\bconfirm\s+(this|if|whether)\b/gi,
];

function extractClaim(text: string): string {
  let t = String(text || "").trim();
  for (const r of WRAPPERS) t = t.replace(r, " ");
  t = t.replace(/^[\s"'“”«»:,\-–—]+/, "").replace(/[\s"'“”«»:,\-–—]+$/, "");
  return plain(t).slice(0, 600).trim();
}

// Greetings, stickers and "ok" carry no claim. Refusing here is cheap and safe.
function isCheckable(claim: string): boolean {
  const n = normalize(claim);
  return n.length >= 15 && tokens(n).length >= 3;
}

// -------------------------------------------------------------- the matcher ---

const PHRASE = 3;      // a multi-word curated keyword found verbatim — strongest signal
const WORD = 2;        // a single distinctive keyword word present
const OVERLAP = 1;     // ordinary word shared with the curated claim
const OVERLAP_CAP = 4; // ...capped, so a long claim cannot win on generic words alone
const MIN_SCORE = 6;
const MIN_HITS = 2;    // one lone keyword is usually coincidence ("baby", "blood")
const MARGIN = 2;      // the winner must clearly beat the runner-up

type Scored = { myth: Myth; score: number; hits: number };

function scoreMyth(myth: Myth, text: string, words: Set<string>, content: Set<string>): Scored {
  let score = 0;
  let hits = 0;
  for (const kw of myth.keywords || []) {
    const k = stemText(kw);
    if (!k) continue;
    if (k.includes(" ")) {
      // A verbatim phrase is near-proof, so it counts as two weak hits.
      if (text.includes(k)) { score += PHRASE; hits += 2; }
    } else if (words.has(k)) {
      score += WORD;
      hits += 1;
    }
  }
  let overlap = 0;
  for (const w of tokens(myth.claim)) if (content.has(stemWord(w))) overlap++;
  score += Math.min(overlap, OVERLAP_CAP) * OVERLAP;
  // Sharing three or more content words with the curated claim is evidence in its
  // own right, so it counts as a hit — many rumours arrive worded quite differently
  // from our keyword list but still restate the same claim almost word for word.
  if (overlap >= 3) hits += 1;
  return { myth, score, hits };
}

// "Confident" = scores past MIN_SCORE, matched at least MIN_HITS worth of curated
// keywords, AND beats any DISAGREEING runner-up by MARGIN. A near-tie only matters
// when the two myths carry different verdicts; if both say "false" either
// explanation is safe, so we take the higher-scoring one. A confident answer to
// the wrong rumour is the worst outcome here, so anything less falls through.
async function matchMyth(claim: string): Promise<Myth | null> {
  const pack = await loadMyths();
  if (!pack.items.length) return null;

  const text = stemText(claim);
  // Two views of her message: every word (so 2-letter keywords like "cs" survive)
  // and content words only (for the fuzzier claim-overlap score).
  const words = new Set(text.split(" ").filter(Boolean));
  const content = new Set(tokens(claim).map(stemWord));

  const ranked = pack.items.map((m) => scoreMyth(m, text, words, content)).sort((a, b) => b.score - a.score);
  const top = ranked[0];
  if (!top || top.score < MIN_SCORE || top.hits < MIN_HITS) return null;
  const rival = ranked.slice(1).find((r) => r.myth.verdict !== top.myth.verdict);
  if (rival && top.score - rival.score < MARGIN) return null;
  return top.myth;
}

// ------------------------------------------------------------ the AI fallback ---

const AI_SYSTEM = [
  "You are a careful maternal-health fact checker for Nigerian mothers.",
  "Judge ONE health claim about pregnancy, birth, newborns or family planning.",
  "Verdicts: \"false\" = wrong or unsafe, \"true\" = correct, \"careful\" = partly true or it depends.",
  "The explanation must be at most 30 words of plain English a mother with basic schooling can act on.",
  "Never mock traditional or religious practice. If a practice is dangerous, say so plainly and point her to the clinic.",
  "Reply with STRICT JSON only, nothing else: {\"verdict\":\"false|true|careful\",\"explanation\":\"...\"}",
  "No markdown, no asterisks, no code fences.",
].join("\n");

// Models wrap JSON in prose or fences no matter what you ask, so dig it out.
function parseJsonObject(raw: string): Record<string, unknown> | null {
  const t = String(raw || "").replace(/```(?:json)?/gi, " ").trim();
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const v: unknown = JSON.parse(t.slice(start, end + 1));
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function toVerdict(x: unknown): MisinfoVerdict | null {
  const v = String(x ?? "").toLowerCase().trim();
  if (/^(false|untrue|wrong|myth|incorrect|fake)$/.test(v)) return "false";
  if (/^(true|correct|accurate|fact)$/.test(v)) return "true";
  if (/^(careful|partly|partly true|partially true|mixed|depends|unproven|unclear|misleading)$/.test(v)) return "careful";
  return null;
}

async function askAi(claim: string): Promise<{ verdict: MisinfoVerdict; explanation: string } | null> {
  const out = await aiComplete({
    temperature: 0.1,
    max_tokens: 220,
    messages: [
      { role: "system", content: AI_SYSTEM },
      { role: "user", content: `Claim: ${claim}` },
    ],
  });
  if (!out.trim()) return null; // model down — caller answers her normally

  const obj = parseJsonObject(out);
  const verdict = toVerdict(obj?.verdict);
  const explanation = plain(String(obj?.explanation ?? ""));
  // No guessing: an unparseable answer about her health is no answer at all.
  if (!verdict || explanation.length < 15) return null;
  return { verdict, explanation };
}

// ----------------------------------------------------------------- the reply ---

const EMOJI: Record<MisinfoVerdict, string> = { false: "❌", true: "✅", careful: "⚠️" };
const HEADLINE: Record<MisinfoVerdict, string> = { false: "Not true.", true: "True.", careful: "Be careful." };
const TAIL = "Please ask your nurse or midwife at your next visit.";
const MAX_WORDS = 55;

// Yoruba/Hausa/Igbo get the whole thing translated; the emoji is added AFTER so
// the translator never has to carry it. Pidgin and English read fine as-is.
async function localize(text: string, lang?: string | null): Promise<string> {
  const code = String(lang || "").toLowerCase();
  if (!isTranslatable(code)) return text;
  const translated = await toLang(code, text);
  return translated ? plain(translated) : text; // translator down → English beats silence
}

async function composeReply(verdict: MisinfoVerdict, explanation: string, lang?: string | null): Promise<string> {
  const head = HEADLINE[verdict];
  const budget = MAX_WORDS - wordCount(head) - wordCount(TAIL);
  const body = clampWords(explanation, budget);
  const text = await localize([head, body, TAIL].filter(Boolean).join("\n"), lang);
  return plain(`${EMOJI[verdict]} ${text}`);
}

/** Classify a claim. Returns null if it isn't checkable. `lang` is en|pcm|yo|ha|ig. */
export async function checkClaim(text: string, lang?: string | null): Promise<MisinfoResult | null> {
  const claim = extractClaim(text);
  if (!isCheckable(claim)) return null;

  const myth = await matchMyth(claim);
  const judged = myth
    ? { verdict: myth.verdict, explanation: myth.explanation }
    : await askAi(claim);
  if (!judged) return null;

  const reply = await composeReply(judged.verdict, judged.explanation, lang);
  return { verdict: judged.verdict, reply, claim, ...(myth ? { matchedMyth: myth.claim } : {}) };
}
