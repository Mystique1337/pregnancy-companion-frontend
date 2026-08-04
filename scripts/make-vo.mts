/**
 * Generate the demo voiceover, one file per scene, into public/vo.
 *
 * Uses macOS `say` so the whole thing is reproducible offline with no API key.
 * It is a placeholder for a human read: swap any .m4a in public/vo for a real
 * recording of the same length and the composition needs no changes.
 *
 *   npx tsx scripts/make-vo.mts [voice] [wordsPerMinute]
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import path from "node:path";

const VOICE = process.argv[2] ?? "Serena";
const RATE = process.argv[3] ?? "158";
const OUT = path.join(process.cwd(), "public", "vo");

/** Scene id -> narration. Keep each line short; the visuals carry the detail. */
export const LINES: Record<string, string> = {
  hook: "She may never download a health app. But she is already on WhatsApp.",
  danger:
    "So when she writes that she is bleeding, Bumply answers in seconds, in her own language. " +
    "It alerts the man who will drive her, and gives her a referral code.",
  loop:
    "Her health worker sees the alert, ranked by risk. The clinic confirms the code. " +
    "Forty seven minutes, from danger sign to care.",
  proof:
    "One hundred per cent sensitivity, across five languages. " +
    "Two hundred and forty naira a month. And it still works with no network at all.",
  outro: "Bumply. The maternal safety layer. Live on WhatsApp today.",
};

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

const durations: Record<string, number> = {};
for (const [id, text] of Object.entries(LINES)) {
  const wav = path.join(OUT, `${id}.wav`);
  // `say` writes WAV directly, which Chromium plays natively. That avoids an
  // afconvert round-trip (its AAC encoder rejects say's default sample format).
  execFileSync("say", ["-v", VOICE, "-r", RATE, "--data-format=LEI16@24000", "-o", wav, text]);
  const info = execFileSync("afinfo", [wav]).toString();
  const secs = Number(/estimated duration: ([\d.]+)/.exec(info)?.[1] ?? 0);
  durations[id] = secs;
  console.log(`  ${id.padEnd(7)} ${secs.toFixed(2)}s  ${text.length} chars`);
}

const fps = 30;
let at = 0;
console.log("\nScene timing at 30fps (add ~0.6s of air between scenes):");
for (const [id, secs] of Object.entries(durations)) {
  const frames = Math.ceil((secs + 0.6) * fps);
  console.log(`  ${id.padEnd(7)} from ${String(at).padStart(4)}  ${String(frames).padStart(4)} frames`);
  at += frames;
}
console.log(`\nTOTAL ${at} frames = ${(at / fps).toFixed(1)}s`);
