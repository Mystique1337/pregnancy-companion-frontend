// Voice client for the Modal-hosted models:
//   SoroTTS  → text-to-speech (Nigerian languages), returns raw 24 kHz mono WAV bytes
//   Whisper  → speech-to-text, returns { text }
// Both scale to zero, so the first call after idle has a ~30–60s cold start.
// We use a 120s timeout + one automatic retry on cold-start timeout / 5xx.
import { stripForSpeech } from "./speechText";
import { readFile } from "node:fs/promises";
import { basename } from "node:path";

const TTS_URL = (process.env.MODAL_TTS_URL || "https://chidi-ashinze--buildsmall-tts-tts-web.modal.run").replace(/\/+$/, "");
const ASR_URL = (process.env.MODAL_ASR_URL || "https://chidi-ashinze--buildsmall-whisper-asr-web.modal.run").replace(/\/+$/, "");
const KEY = process.env.MODAL_API_KEY || "";
const TIMEOUT_MS = 120_000;

export type Voice = "yo" | "ha" | "ig" | "pcm" | "en";
const VOICES: Voice[] = ["yo", "ha", "ig", "pcm", "en"];
export function normalizeVoice(v: unknown): Voice {
  return VOICES.includes(v as Voice) ? (v as Voice) : "en";
}

function authHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return { ...(KEY ? { Authorization: `Bearer ${KEY}` } : {}), ...extra };
}

async function timedFetch(url: string, init: RequestInit): Promise<Response> {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal, cache: "no-store" });
  } finally {
    clearTimeout(id);
  }
}

// Retry once on a cold-start timeout (AbortError) or a 5xx response.
async function withColdRetry<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (e) {
    const status = (e as { status?: number }).status;
    const aborted = (e as { name?: string }).name === "AbortError";
    if (aborted || (status && status >= 500 && status < 600)) {
      return await run(); // single retry — gives the cold container time to warm
    }
    throw e;
  }
}

/** Text → WAV bytes. `voice` is a language code (yo/ha/ig/pcm/en). */
export async function speak(text: string, voice: Voice = "yo"): Promise<Buffer> {
  const body = JSON.stringify({ input: stripForSpeech(String(text)).slice(0, 1200), voice: normalizeVoice(voice), model: "sorotts" });
  return withColdRetry(async () => {
    const res = await timedFetch(`${TTS_URL}/v1/audio/speech`, {
      method: "POST",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body,
    });
    if (!res.ok) {
      const err = new Error(`TTS HTTP ${res.status}: ${await res.text().catch(() => "")}`) as Error & { status: number };
      err.status = res.status;
      throw err;
    }
    return Buffer.from(await res.arrayBuffer());
  });
}

// A tiny silent WAV, used to wake the ASR container.
function silentWav(ms = 100, rate = 16000): Buffer {
  const samples = Math.floor((rate * ms) / 1000);
  const dataLen = samples * 2; // 16-bit mono
  const buf = Buffer.alloc(44 + dataLen);
  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + dataLen, 4);
  buf.write("WAVE", 8);
  buf.write("fmt ", 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(rate, 24);
  buf.writeUInt32LE(rate * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write("data", 36);
  buf.writeUInt32LE(dataLen, 40);
  return buf;
}

// Wake both Modal containers (best-effort) so the user's first real use is fast.
// They scale back to zero on their own after ~5 min idle.
export async function warm(): Promise<void> {
  await Promise.allSettled([speak("hi", "en"), transcribe(silentWav(), "warm.wav")]);
}

/** Audio (file path, Buffer, or Blob) → transcribed text. */
export async function transcribe(audio: string | Buffer | Blob, filename = "clip.wav"): Promise<string> {
  let blob: Blob;
  let name = filename;
  if (typeof audio === "string") {
    blob = new Blob([new Uint8Array(await readFile(audio))]);
    name = basename(audio);
  } else if (Buffer.isBuffer(audio)) {
    blob = new Blob([new Uint8Array(audio)]);
  } else {
    blob = audio;
  }

  return withColdRetry(async () => {
    const form = new FormData();
    form.append("file", blob, name);
    form.append("model", "whisper");
    const res = await timedFetch(`${ASR_URL}/v1/audio/transcriptions`, {
      method: "POST",
      headers: authHeaders(), // let fetch set the multipart boundary
      body: form,
    });
    if (!res.ok) {
      const err = new Error(`ASR HTTP ${res.status}: ${await res.text().catch(() => "")}`) as Error & { status: number };
      err.status = res.status;
      throw err;
    }
    const d = (await res.json()) as { text?: string };
    return String(d.text || "").trim();
  });
}
