/**
 * Generate the demo voiceover, one file per scene, into public/vo.
 *
 * Uses our own SoroTTS deployment, so the pitch is narrated by the same
 * Nigerian voice the product speaks to mothers in. Falls back to macOS `say`
 * only if SoroTTS is unreachable, and says so loudly when it does.
 *
 *   npx tsx scripts/make-vo.mts            # SoroTTS, Nigerian English
 *   npx tsx scripts/make-vo.mts pcm        # Nigerian Pidgin voice
 *   npx tsx scripts/make-vo.mts en --say   # force the macOS fallback
 */
import { readFileSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";

// Load .env.local before importing app modules that read env at import time.
try {
  for (const line of readFileSync(".env.local", "utf8").split("\n")) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
} catch {
  /* fine: fall back to whatever is already in the environment */
}

const { speak, normalizeVoice } = await import("../lib/voice");

const VOICE = normalizeVoice(process.argv[2] ?? "en");
const FORCE_SAY = process.argv.includes("--say");
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

/** WAV duration straight from the header, so we do not need ffprobe. */
function wavSeconds(buf: Buffer): number {
  const rate = buf.readUInt32LE(24);
  const bytesPerSec = buf.readUInt32LE(28) || rate * 2;
  // find the data chunk rather than assuming a 44-byte header
  let off = 12;
  while (off + 8 <= buf.length) {
    const id = buf.toString("ascii", off, off + 4);
    const len = buf.readUInt32LE(off + 4);
    if (id === "data") return len / bytesPerSec;
    off += 8 + len + (len % 2);
  }
  return (buf.length - 44) / bytesPerSec;
}

const durations: Record<string, number> = {};
let usedFallback = false;

for (const [id, text] of Object.entries(LINES)) {
  const file = path.join(OUT, `${id}.wav`);
  let secs: number;
  let how: string;

  if (!FORCE_SAY) {
    try {
      // First call after idle pays a 30-60s Modal cold start; speak() retries once.
      const wav = await speak(text, VOICE);
      writeFileSync(file, wav);
      secs = wavSeconds(wav);
      how = `SoroTTS/${VOICE}`;
    } catch (e) {
      usedFallback = true;
      how = `say (SoroTTS failed: ${(e as Error).message.slice(0, 60)})`;
      execFileSync("say", ["-v", "Serena", "-r", "158", "--data-format=LEI16@24000", "-o", file, text]);
      secs = wavSeconds(readFileSync(file));
    }
  } else {
    execFileSync("say", ["-v", "Serena", "-r", "158", "--data-format=LEI16@24000", "-o", file, text]);
    secs = wavSeconds(readFileSync(file));
    how = "say (forced)";
  }

  durations[id] = secs;
  console.log(`  ${id.padEnd(7)} ${secs.toFixed(2)}s  ${how}`);
}

const fps = 30;
let at = 0;
const timing: Array<[string, number, number]> = [];
for (const [id, secs] of Object.entries(durations)) {
  const frames = Math.ceil((secs + 0.6) * fps); // ~0.6s of air after each line
  timing.push([id, at, frames]);
  at += frames;
}

console.log("\nPaste into PitchDemo.tsx:");
const comp = ["Hook", "DangerScene", "LoopScene", "ProofScene", "Outro"];
timing.forEach(([id, from, frames], i) => {
  const open = i === 0 ? `<Sequence durationInFrames={${frames}}>` : `<Sequence from={${from}} durationInFrames={${frames}}>`;
  console.log(`  ${open}<${comp[i]} /></Sequence>`);
});
console.log(`\nRoot.tsx durationInFrames={${at}}   (${(at / fps).toFixed(1)}s)`);
if (usedFallback) console.log("\n!! At least one line used the macOS fallback, not SoroTTS.");

writeFileSync(path.join(OUT, "timing.json"), JSON.stringify({ fps, total: at, timing }, null, 2));
