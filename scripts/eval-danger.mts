// EVALUATION HARNESS for the Bumply danger-sign detector.
//
// This is the artefact that turns "our safety layer works" into a measured
// claim. It runs lib/dangerSigns.ts over a curated benchmark of realistic
// WhatsApp-style messages (data/danger-benchmark.jsonl) and reports
// sensitivity, specificity, precision, F1 and balanced accuracy, plus
// per-language and per-category breakdowns and every single failing case.
//
// Detection is scored BINARY (any hit vs no hit) — that is the decision that
// actually changes what the mother is told. Level (emergency vs urgent) and
// sign accuracy are reported separately, on true positives only.
//
// Run:   npx tsx scripts/eval-danger.mts
//        npx tsx scripts/eval-danger.mts --fail-under-sens=95
//
// Exits 1 if sensitivity falls below --fail-under-sens (default 90), so it can
// gate CI. No test framework, no external deps.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { detectDangerSign, type DangerHit } from "../lib/dangerSigns.ts";

// ─────────────────────────── args ───────────────────────────
function arg(name: string, fallback: string): string {
  const hit = process.argv.slice(2).find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
}
const DATA = resolve(process.cwd(), arg("data", "data/danger-benchmark.jsonl"));
const OUT = resolve(process.cwd(), arg("out", "docs/eval-danger-report.md"));
const FAIL_UNDER_SENS = Number(arg("fail-under-sens", "90"));
const MAX_FAILURE_LINES = Number(arg("max-failures", "40"));

// ─────────────────────────── data ───────────────────────────
type Expect = "emergency" | "urgent" | "none";
type Row = { text: string; lang: string; expect: Expect; sign?: string; note?: string };

function loadRows(path: string): Row[] {
  const raw = readFileSync(path, "utf8");
  const rows: Row[] = [];
  raw.split("\n").forEach((line, i) => {
    const s = line.trim();
    if (!s) return;
    let o: Row;
    try { o = JSON.parse(s) as Row; }
    catch { throw new Error(`data/danger-benchmark.jsonl line ${i + 1}: not valid JSON — ${s.slice(0, 60)}`); }
    if (typeof o.text !== "string" || !o.text.trim()) throw new Error(`line ${i + 1}: missing "text"`);
    if (!["emergency", "urgent", "none"].includes(o.expect)) throw new Error(`line ${i + 1}: bad "expect" (${o.expect})`);
    if (!o.lang) o.lang = "en";
    rows.push(o);
  });
  return rows;
}

// ─────────────────────────── scoring ───────────────────────────
type Outcome = "TP" | "FN" | "FP" | "TN";
type Scored = Row & { got: DangerHit | null; outcome: Outcome; levelOk: boolean | null; signOk: boolean | null };

const rows = loadRows(DATA);
const scored: Scored[] = rows.map((r) => {
  const got = detectDangerSign(r.text);
  const shouldFlag = r.expect !== "none";
  const didFlag = got !== null;
  const outcome: Outcome = shouldFlag ? (didFlag ? "TP" : "FN") : didFlag ? "FP" : "TN";
  // level / sign only meaningful on a true positive (we detected something)
  const levelOk = outcome === "TP" ? got!.level === r.expect : null;
  const signOk = shouldFlag && r.sign ? (got ? got.sign.toLowerCase().includes(r.sign.toLowerCase()) : false) : null;
  return { ...r, got, outcome, levelOk, signOk };
});

const count = (o: Outcome, pool: Scored[] = scored) => pool.filter((s) => s.outcome === o).length;
const TP = count("TP"), FN = count("FN"), FP = count("FP"), TN = count("TN");

const ratio = (num: number, den: number) => (den === 0 ? NaN : num / den);
const sensitivity = ratio(TP, TP + FN);
const specificity = ratio(TN, TN + FP);
const precision = ratio(TP, TP + FP);
const f1 = ratio(2 * TP, 2 * TP + FP + FN);
const balanced = (sensitivity + specificity) / 2;

const pct = (x: number) => (Number.isNaN(x) ? "  n/a" : (x * 100).toFixed(1) + "%");
const pad = (s: string, n: number) => (s.length >= n ? s : s + " ".repeat(n - s.length));
const padL = (s: string, n: number) => (s.length >= n ? s : " ".repeat(n - s.length) + s);

// level + sign accuracy over the positives
const tps = scored.filter((s) => s.outcome === "TP");
const levelCorrect = tps.filter((s) => s.levelOk).length;
const signLabelled = scored.filter((s) => s.expect !== "none" && s.sign);
const signCorrect = signLabelled.filter((s) => s.signOk).length;
const signCorrectOfDetected = signLabelled.filter((s) => s.outcome === "TP" && s.signOk).length;
const signDetected = signLabelled.filter((s) => s.outcome === "TP").length;

// ─────────────────────────── report buffer ───────────────────────────
const md: string[] = [];
function say(line = "") { console.log(line); md.push(line); }

const stamp = new Date().toISOString().slice(0, 16).replace("T", " ") + " UTC";
say(`# Danger-sign detector — evaluation report`);
say();
say(`Generated \`${stamp}\` by \`npx tsx scripts/eval-danger.mts\``);
say(`Benchmark: \`data/danger-benchmark.jsonl\` · detector: \`lib/dangerSigns.ts\` (\`detectDangerSign\`)`);
say();
say("```");
say(`Examples ................ ${rows.length}`);
say(`  danger (positives) .... ${TP + FN}   (emergency ${rows.filter((r) => r.expect === "emergency").length} · urgent ${rows.filter((r) => r.expect === "urgent").length})`);
say(`  safe   (negatives) .... ${TN + FP}`);
say("```");
say();

// ── confusion matrix ──
say(`## Confusion matrix (binary: any danger sign vs none)`);
say();
say("```");
say(`                      predicted DANGER   predicted NONE`);
say(`  actual DANGER   ${padL(String(TP), 14)} (TP)  ${padL(String(FN), 12)} (FN)`);
say(`  actual SAFE     ${padL(String(FP), 14)} (FP)  ${padL(String(TN), 12)} (TN)`);
say("```");
say();

say(`## Headline metrics`);
say();
say("```");
say(`  Sensitivity (recall) ...... ${pct(sensitivity)}   ${TP}/${TP + FN} danger messages caught      <-- the safety number`);
say(`  Specificity ............... ${pct(specificity)}   ${TN}/${TN + FP} safe messages left alone`);
say(`  Precision (PPV) ........... ${pct(precision)}   ${TP}/${TP + FP} alerts were real`);
say(`  F1 ........................ ${pct(f1)}`);
say(`  Balanced accuracy ......... ${pct(balanced)}`);
say(`  Level accuracy (E vs U) ... ${pct(ratio(levelCorrect, tps.length))}   ${levelCorrect}/${tps.length} detected cases got the right urgency`);
say(`  Sign accuracy ............. ${pct(ratio(signCorrect, signLabelled.length))}   ${signCorrect}/${signLabelled.length} sign-labelled cases mapped to the right category`);
say(`    (of those detected) ..... ${pct(ratio(signCorrectOfDetected, signDetected))}   ${signCorrectOfDetected}/${signDetected}`);
say("```");
say();

// ── per language ──
say(`## Per-language breakdown`);
say();
say("```");
say(`  ${pad("lang", 6)}${padL("n", 5)}${padL("pos", 6)}${padL("neg", 6)}${padL("sens", 9)}${padL("spec", 9)}`);
say(`  ${"-".repeat(41)}`);
const langOrder = ["en", "pcm", "yo", "ha", "ig"];
const langs = [...new Set(scored.map((s) => s.lang))].sort(
  (a, b) => (langOrder.indexOf(a) + 99 * Number(langOrder.indexOf(a) < 0)) - (langOrder.indexOf(b) + 99 * Number(langOrder.indexOf(b) < 0)),
);
type LangRow = { lang: string; n: number; pos: number; neg: number; sens: number; spec: number };
const langRows: LangRow[] = [];
for (const lang of langs) {
  const pool = scored.filter((s) => s.lang === lang);
  const tp = count("TP", pool), fn = count("FN", pool), fp = count("FP", pool), tn = count("TN", pool);
  const sens = ratio(tp, tp + fn), spec = ratio(tn, tn + fp);
  langRows.push({ lang, n: pool.length, pos: tp + fn, neg: tn + fp, sens, spec });
  say(`  ${pad(lang, 6)}${padL(String(pool.length), 5)}${padL(String(tp + fn), 6)}${padL(String(tn + fp), 6)}${padL(pct(sens), 9)}${padL(pct(spec), 9)}`);
}
say("```");
say();

// ── per category ──
say(`## Per-category breakdown (grouped by expected sign)`);
say();
say("```");
say(`  ${pad("expected sign", 30)}${padL("n", 4)}${padL("hit", 5)}${padL("sens", 8)}${padL("lvl", 6)}${padL("sign", 7)}`);
say(`  ${"-".repeat(60)}`);
const cats = [...new Set(scored.filter((s) => s.expect !== "none").map((s) => s.sign || "(unlabelled)"))];
type CatRow = { sign: string; n: number; hit: number; sens: number; lvl: string; sgn: string };
const catRows: CatRow[] = [];
for (const cat of cats) {
  const pool = scored.filter((s) => s.expect !== "none" && (s.sign || "(unlabelled)") === cat);
  const hit = count("TP", pool);
  const sens = ratio(hit, pool.length);
  const lvl = pool.filter((s) => s.levelOk).length;
  const sgn = pool.filter((s) => s.signOk).length;
  catRows.push({ sign: cat, n: pool.length, hit, sens, lvl: `${lvl}/${hit}`, sgn: `${sgn}/${pool.length}` });
  say(`  ${pad(cat, 30)}${padL(String(pool.length), 4)}${padL(String(hit), 5)}${padL(pct(sens), 8)}${padL(`${lvl}/${hit}`, 6)}${padL(`${sgn}/${pool.length}`, 7)}`);
}
say(`  ${"-".repeat(60)}`);
say(`  ${pad("(negatives — expect: none)", 30)}${padL(String(TN + FP), 4)}${padL(String(FP), 5)}${padL(pct(specificity), 8)}${padL("-", 6)}${padL("-", 7)}`);
say(`  columns: n = examples · hit = detected · sens = recall · lvl = right urgency (of detected) · sign = right category`);
say("```");
say();

// ── failures ──
const fns = scored.filter((s) => s.outcome === "FN");
const fps = scored.filter((s) => s.outcome === "FP");
say(`## Failures`);
say();
say(`${fns.length} false negative(s) — a real danger sign the detector did NOT flag. These are the dangerous ones.`);
say(`${fps.length} false positive(s) — a safe message the detector escalated. These cost trust and clinic time.`);
say();
say("```");
let printed = 0;
const truncated = { fn: 0, fp: 0 };
say(`  FALSE NEGATIVES (missed danger) — ${fns.length}`);
for (const s of fns) {
  if (printed >= MAX_FAILURE_LINES) { truncated.fn++; continue; }
  printed++;
  say(`  ${padL(String(printed), 3)}. [${pad(s.lang, 3)}] expected ${pad(s.expect, 9)} (${s.sign || "-"}) | got: none`);
  say(`       "${s.text}"`);
}
if (truncated.fn) say(`       ... and ${truncated.fn} more false negative(s) (raise --max-failures to see them)`);
say();
say(`  FALSE POSITIVES (false alarm) — ${fps.length}`);
for (const s of fps) {
  if (printed >= MAX_FAILURE_LINES) { truncated.fp++; continue; }
  printed++;
  say(`  ${padL(String(printed), 3)}. [${pad(s.lang, 3)}] expected none      | got: ${s.got!.level} / ${s.got!.sign}`);
  say(`       "${s.text}"${s.note ? `\n       why safe: ${s.note}` : ""}`);
}
if (truncated.fp) say(`       ... and ${truncated.fp} more false positive(s) (raise --max-failures to see them)`);
say("```");
say();

// ── level mismatches (informational, not a binary failure) ──
const levelMiss = tps.filter((s) => s.levelOk === false);
if (levelMiss.length) {
  say(`## Under/over-triage (detected, but wrong urgency)`);
  say();
  say("```");
  for (const s of levelMiss.slice(0, 20)) {
    say(`  [${pad(s.lang, 3)}] expected ${pad(s.expect, 9)} -> got ${pad(s.got!.level, 9)} | ${s.got!.sign}`);
    say(`       "${s.text}"`);
  }
  if (levelMiss.length > 20) say(`  ... and ${levelMiss.length - 20} more`);
  say("```");
  say();
}

say(`## Gate`);
say();
say("```");
const passGate = !Number.isNaN(sensitivity) && sensitivity * 100 >= FAIL_UNDER_SENS;
say(`  --fail-under-sens=${FAIL_UNDER_SENS}  ->  measured sensitivity ${pct(sensitivity)}  ->  ${passGate ? "PASS" : "FAIL"}`);
say("```");
say();

// ── machine-readable summary ──
const summary = {
  total: rows.length,
  positives: TP + FN,
  negatives: TN + FP,
  tp: TP, fn: FN, fp: FP, tn: TN,
  sensitivity: Number((sensitivity * 100).toFixed(1)),
  specificity: Number((specificity * 100).toFixed(1)),
  precision: Number((precision * 100).toFixed(1)),
  f1: Number((f1 * 100).toFixed(1)),
  balancedAccuracy: Number((balanced * 100).toFixed(1)),
  levelAccuracy: Number((ratio(levelCorrect, tps.length) * 100).toFixed(1)),
  signAccuracy: Number((ratio(signCorrect, signLabelled.length) * 100).toFixed(1)),
  byLang: Object.fromEntries(langRows.map((l) => [l.lang, { n: l.n, sens: Number((l.sens * 100).toFixed(1)), spec: Number((l.spec * 100).toFixed(1)) }])),
  failUnderSens: FAIL_UNDER_SENS,
  pass: passGate,
};
const resultLine = "RESULT_JSON: " + JSON.stringify(summary);
md.push("## Machine-readable summary");
md.push("");
md.push("```");
md.push(resultLine);
md.push("```");
md.push("");

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, md.join("\n"));
console.log(`Report written to ${OUT.replace(process.cwd() + "/", "")}`);
console.log();
console.log(resultLine);

process.exit(passGate ? 0 : 1);
