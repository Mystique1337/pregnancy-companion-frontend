// Pure-logic UNIT tests for Bumply. No server, no network, no DB — we import the
// lib functions directly and assert on their return values. Run: `npx tsx scripts/unit.mts`.
// Mirrors the tiny assert/summary style of scripts/e2e.mts.
import { readFileSync } from "node:fs";

// Load .env.local (best-effort) so that importing modules which transitively touch
// lib/db (only waOnboard here) pick the lazy REST path instead of warning. The pure
// modules under test need no env at all.
try {
  const env = readFileSync(".env.local", "utf8");
  for (const line of env.split("\n")) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
} catch { /* no .env.local — fine for the pure tests */ }

import { detectDangerSign, dangerReply } from "../lib/dangerSigns.ts";
import { weeksSinceBirth, immunizationPlan, nextImmunization, immunizationReminder } from "../lib/immunization.ts";
import { retrieve, type Kb } from "../lib/offlineKb.ts";
import { detectBirthAnnouncement } from "../lib/postpartum.ts";

let pass = 0, fail = 0;
const fails: string[] = [];
function ok(name: string, cond: boolean, detail = "") {
  if (cond) { pass++; console.log("  ✓ " + name); }
  else { fail++; fails.push(name + (detail ? ` — ${detail}` : "")); console.log("  ✗ " + name + (detail ? ` — ${detail}` : "")); }
}

// ─────────────────────────── dangerSigns.ts ───────────────────────────
console.log("\n— Danger signs (detectDangerSign / dangerReply) —");
{
  const heavy = detectDangerSign("I dey see plenty blood");
  ok("heavy bleeding → sign 'heavy bleeding'", heavy?.sign === "heavy bleeding", JSON.stringify(heavy));
  ok("heavy bleeding → level 'emergency'", heavy?.level === "emergency", JSON.stringify(heavy));

  const noMove = detectDangerSign("my baby never move today");
  ok("baby not moving → sign 'baby not moving'", noMove?.sign === "baby not moving", JSON.stringify(noMove));
  ok("baby not moving → level 'urgent'", noMove?.level === "urgent", JSON.stringify(noMove));

  const fits = detectDangerSign("I get convulsion now");
  ok("convulsion → sign 'fits/convulsions'", fits?.sign === "fits/convulsions", JSON.stringify(fits));
  ok("convulsion → level 'emergency'", fits?.level === "emergency", JSON.stringify(fits));

  const nbBreath = detectDangerSign("my baby no dey breathe well");
  ok("newborn not breathing → newborn: sign", !!nbBreath && nbBreath.sign.startsWith("newborn:"), JSON.stringify(nbBreath));
  ok("newborn not breathing → level 'emergency'", nbBreath?.level === "emergency", JSON.stringify(nbBreath));
  const nbReply = nbBreath ? dangerReply("Ada", nbBreath) : "";
  ok("dangerReply(newborn) mentions baby", /baby/i.test(nbReply));
  ok("dangerReply(newborn) mentions hospital", /hospital/i.test(nbReply));

  const jaundice = detectDangerSign("baby skin dey yellow");
  ok("jaundice → newborn jaundice sign", jaundice?.sign === "newborn: yellow skin or eyes (jaundice)", JSON.stringify(jaundice));
  ok("jaundice → level 'urgent'", jaundice?.level === "urgent", JSON.stringify(jaundice));

  const feed = detectDangerSign("my baby no dey suck breast");
  ok("not feeding → newborn feeding sign", feed?.sign === "newborn: not feeding / refusing breast", JSON.stringify(feed));
  ok("not feeding → level 'urgent'", feed?.level === "urgent", JSON.stringify(feed));

  const food = detectDangerSign("what should I eat today");
  ok("benign food question → null (no danger)", food === null, JSON.stringify(food));

  const bp = detectDangerSign("my blood pressure is fine");
  ok("'blood pressure' NOT flagged as bleeding", bp === null || (bp.sign !== "heavy bleeding" && bp.sign !== "vaginal bleeding"), JSON.stringify(bp));

  // Native-language (Yoruba/Hausa/Igbo) additive terms.
  ok("Yoruba 'mo n rí ẹjẹ' → bleeding", detectDangerSign("mo n rí ẹjẹ")?.sign?.includes("bleeding") === true);
  ok("Hausa 'ina zubar da jini' → bleeding", detectDangerSign("ina zubar da jini")?.sign?.includes("bleeding") === true);
  ok("Igbo 'ọ na-agba ọbara' → bleeding", detectDangerSign("ọ na-agba ọbara")?.sign?.includes("bleeding") === true);
  ok("Yoruba 'mo ni warapa' → fits (emergency)", detectDangerSign("mo ni warapa")?.level === "emergency");
  ok("Hausa 'ina da zazzabi mai zafi' → high fever", detectDangerSign("ina da zazzabi mai zafi")?.sign === "high fever");
  // False-positive guards: bounded regex must NOT trip on English words containing 'eje'/'j'.
  ok("'I reject this idea' → NOT flagged", detectDangerSign("I reject this idea") === null);
  ok("'just relax and enjoy' → NOT flagged", detectDangerSign("just relax and enjoy") === null);

  // "blood" needs bleeding context — everyday anaemia/test chat must NOT hijack.
  ok("'which food dey give blood' → NOT flagged", detectDangerSign("which food dey give blood") === null);
  ok("'my blood level is low' → NOT flagged", detectDangerSign("my blood level is low") === null);
  ok("'I get blood test tomorrow' → NOT flagged", detectDangerSign("I get blood test tomorrow") === null);
  ok("'my gums dey bleed small' → NOT flagged", detectDangerSign("my gums dey bleed small") === null);
  ok("'I see blood for my pant' → urgent bleeding", detectDangerSign("I see blood for my pant")?.level === "urgent");
  ok("'I am bleeding' → still urgent", detectDangerSign("I am bleeding")?.level === "urgent");
}

// ─────────────────────────── detectLang.ts ───────────────────────────
console.log("\n— detectLang (per-message language) —");
{
  const { detectMessageLanguage } = await import("../lib/detectLang.ts");
  ok("Pidgin: 'wetin i go chop, abeg' → pcm", detectMessageLanguage("wetin i go chop, abeg") === "pcm");
  ok("Hausa: 'sannu, ina da ciki yanzu' → ha", detectMessageLanguage("sannu, ina da ciki yanzu") === "ha");
  ok("Igbo: 'kedu, biko nwa m' → ig", detectMessageLanguage("kedu, biko nwa m") === "ig");
  ok("Yoruba: 'bawo, mo ni oyun' → yo", detectMessageLanguage("bawo, mo ni oyun") === "yo");
  ok("Yoruba diacritics: 'ẹ jọ̀wọ́ ṣe iranlọwọ' → yo", detectMessageLanguage("ẹ jọ̀wọ́ ṣe iranlọwọ") === "yo");
  ok("plain English → null (uses stored)", detectMessageLanguage("what should I eat today?") === null);
  ok("short/ambiguous 'ok' → null", detectMessageLanguage("ok") === null);
}

// ─────────────────────────── langSwitch.ts ───────────────────────────
console.log("\n— langSwitch (in-chat language change) —");
{
  const { detectLanguageChange, isLanguageMenuRequest } = await import("../lib/langSwitch.ts");
  ok("'speak yoruba' → yo", detectLanguageChange("speak yoruba") === "yo");
  ok("'/language hausa' → ha", detectLanguageChange("/language hausa") === "ha");
  ok("'change language to igbo' → ig", detectLanguageChange("change language to igbo") === "ig");
  ok("'abeg make we yarn pidgin' → pcm", detectLanguageChange("abeg make we yarn pidgin") === "pcm");
  ok("'reply in english' → en", detectLanguageChange("reply in english") === "en");
  ok("'I will speak to my doctor' → null", detectLanguageChange("I will speak to my doctor") === null);
  ok("'my igbo friend visited me today' → null", detectLanguageChange("my igbo friend visited me today") === null);
  ok("'language' shows the menu", isLanguageMenuRequest("language") === true && isLanguageMenuRequest("/language") === true);
  ok("normal chat is not a menu request", isLanguageMenuRequest("what should I eat") === false);
}

// ─────────────────────────── speechText.ts stripForSpeech ───────────────────────────
console.log("\n— stripForSpeech (TTS text hygiene) —");
{
  const { stripForSpeech } = await import("../lib/speechText.ts");
  ok("strips emojis", stripForSpeech("Rest well, mama 🌸💛🤰🏿") === "Rest well, mama");
  ok("strips markdown markers", stripForSpeech("*Drink water* and _rest_ o!") === "Drink water and rest o!");
  ok("keeps plain Pidgin untouched", stripForSpeech("Na normal thing, no worry.") === "Na normal thing, no worry.");
  ok("collapses leftover double spaces", !/\s{2}/.test(stripForSpeech("Eat 🍚 rice and 🥬 vegetables")));
}

// ─────────────────────────── ai.ts cleanReply ───────────────────────────
console.log("\n— cleanReply (reply hygiene) —");
{
  const { cleanReply } = await import("../lib/ai.ts");
  ok("strips hallucinated 'User:' turns", cleanReply("Rest well, mama.\nUser: ok\nAssistant: Great!") === "Rest well, mama.");
  ok("strips <think> blocks", cleanReply("<think>reasoning...</think>Drink water today 🌸") === "Drink water today 🌸");
  ok("strips leading 'Assistant:' label", cleanReply("Assistant: You dey do well!") === "You dey do well!");
  ok("leaves a clean reply untouched", cleanReply("Na normal thing, no worry. How your body dey today?") === "Na normal thing, no worry. How your body dey today?");
  ok("unwraps full-reply quotation marks", cleanReply('"Hey mama, big hug! Rest well today."') === "Hey mama, big hug! Rest well today.");
  ok("strips a lone leading quote", cleanReply('"Rest well today, mama.') === "Rest well today, mama.");
  ok("keeps quotes INSIDE a reply", cleanReply('Doctors call it "morning sickness" but it can strike anytime.') === 'Doctors call it "morning sickness" but it can strike anytime.');
}

// ─────────────────────────── immunization.ts ───────────────────────────
console.log("\n— Immunization (explicit `now`, ~7 weeks after birth) —");
{
  const now = new Date("2026-07-15T00:00:00.000Z");
  const birthDate = new Date(now.getTime() - 49 * 24 * 3600 * 1000).toISOString().slice(0, 10); // exactly 7 weeks before

  const wk = weeksSinceBirth(birthDate, now);
  ok("weeksSinceBirth ≈ 7", wk === 7, `got ${wk}`);

  const plan = immunizationPlan(birthDate, now);
  const sixWk = plan.visits.find((v) => v.ageWeeks === 6);
  ok("6-week visit status is 'due' or 'done'", sixWk?.status === "due" || sixWk?.status === "done", JSON.stringify(sixWk?.status));

  const next = nextImmunization(birthDate, now);
  ok("nextImmunization returns a visit object", !!next && typeof next.label === "string" && Array.isArray(next.vaccines), JSON.stringify(next?.label));

  const reminder = immunizationReminder("Ada", birthDate, now);
  ok("immunizationReminder returns a string", typeof reminder === "string" && reminder.length > 0);
  ok("reminder contains a vaccine name (Penta/OPV)", !!reminder && /(Penta|OPV)/.test(reminder), reminder || "null");

  // birthDate = null → no birth yet
  const wkNull = weeksSinceBirth(null, now);
  ok("weeksSinceBirth(null) → null", wkNull === null, JSON.stringify(wkNull));
  const planNull = immunizationPlan(null, now);
  ok("plan(null).weeks → null", planNull.weeks === null, JSON.stringify(planNull.weeks));
  ok("plan(null): every visit status 'upcoming'", planNull.visits.every((v) => v.status === "upcoming"), JSON.stringify(planNull.visits.map((v) => v.status)));
}

// ─────────────────────────── offlineKb.ts ───────────────────────────
console.log("\n— Offline KB (retrieve) —");
{
  const kb: Kb = {
    items: [
      { q: "What helps with morning nausea?", a: "Eat small frequent meals and try ginger tea.", tags: ["nausea", "vomiting", "morning sickness"] },
      { q: "Is it safe to exercise while pregnant?", a: "Gentle walking and stretching are good.", tags: ["exercise", "activity", "walking"] },
      { q: "How much water should I drink?", a: "Aim for about eight glasses a day.", tags: ["hydration", "water", "drinking"] },
    ],
  };

  const hitTag = retrieve(kb, "I keep vomiting from nausea every morning");
  ok("tag-matching query returns the nausea item", hitTag?.item.q === kb.items[0].q, JSON.stringify(hitTag?.item.q));
  ok("matching item has the top (positive) score", (hitTag?.score ?? 0) > 0, JSON.stringify(hitTag?.score));

  const empty = retrieve(kb, "");
  ok("empty query → null", empty === null, JSON.stringify(empty));

  const garbage = retrieve(kb, "zzz qqq xyzzy");
  ok("garbage query → null or score 0", garbage === null || garbage.score === 0, JSON.stringify(garbage?.score));
}

// ─────────────────────────── postpartum.ts ───────────────────────────
console.log("\n— Postpartum (detectBirthAnnouncement) —");
{
  ok("'I don born' → true", detectBirthAnnouncement("I don born") === true);
  ok("'baby don come' → true", detectBirthAnnouncement("baby don come") === true);
  ok("'when will my baby come?' → false", detectBirthAnnouncement("when will my baby come?") === false);
  const longPara =
    "I have been reading a lot about what happens around the time of birth and I am curious about how labour usually starts and what signs to watch for before then.";
  ok("long (>120 char) paragraph mentioning birth → false", longPara.length > 120 && detectBirthAnnouncement(longPara) === false, `len ${longPara.length}`);
}

// ─────────────────────────── waOnboard.ts (pure helpers) ───────────────────────────
console.log("\n— waOnboard.ts —");
{
  const { parseWeek, cleanName } = await import("../lib/waOnboard.ts");
  ok("parseWeek '20' → 20", parseWeek("20") === 20);
  ok("parseWeek '20 weeks' → 20", parseWeek("20 weeks") === 20);
  ok("parseWeek 'week 12' → 12", parseWeek("week 12") === 12);
  ok("parseWeek '2 months' → ~9", parseWeek("2 months") === 9);
  ok("parseWeek '99' → null (out of range)", parseWeek("99") === null);
  ok("parseWeek 'hello' → null", parseWeek("hello") === null);
  ok("cleanName 'my name is Amina' → 'Amina'", cleanName("my name is Amina") === "Amina");
  ok("cleanName 'I am Ngozi Okafor' → 'Ngozi Okafor'", cleanName("I am Ngozi Okafor") === "Ngozi Okafor");
  ok("cleanName strips digits/punct", !/[0-9!?]/.test(cleanName("Bola123!")));
}

console.log(`\n=========== ${pass} passed · ${fail} failed ===========`);
if (fails.length) console.log("FAILURES:\n - " + fails.join("\n - "));
process.exit(fail ? 1 : 0);
