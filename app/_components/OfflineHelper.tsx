"use client";
// Experimental on-device AI helper: SmolLM2-135M-Instruct (~135M params) running
// fully in the browser via transformers.js (WASM). Opt-in (~100MB one-time
// download, cached), then answers offline. Basic quality — the deterministic
// danger-sign checker above is the safety layer; this is a bonus for free chat
// when there's no signal.
import { useRef, useState } from "react";
import { detectDangerSign, dangerReply } from "@/lib/dangerSigns";
import { loadKb, retrieve, type Kb } from "@/lib/offlineKb";
import { speakLocal } from "@/lib/localVoice";
import { readCachedProfile } from "./ProfileCache";

// Runtime dynamic import from CDN, hidden from the bundler (keeps it out of the app bundle).
const cdnImport = (u: string) => (new Function("u", "return import(u)"))(u) as Promise<Record<string, unknown>>;
const TRANSFORMERS = "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.5.1";
const MODEL = "HuggingFaceTB/SmolLM2-135M-Instruct";
const ASR_MODEL = "onnx-community/whisper-tiny.en"; // ~75MB, offline speech-to-text
const VLM_MODEL = "HuggingFaceTB/SmolVLM-256M-Instruct"; // ~256M, offline photo reading

// Decode a recorded audio Blob to 16kHz mono Float32 for Whisper.
async function blobTo16k(blob: Blob): Promise<Float32Array> {
  const ab = await blob.arrayBuffer();
  const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const decoded = await new AC().decodeAudioData(ab);
  const off = new OfflineAudioContext(1, Math.ceil(decoded.duration * 16000), 16000);
  const src = off.createBufferSource();
  src.buffer = decoded; src.connect(off.destination); src.start();
  return (await off.startRendering()).getChannelData(0);
}

// Speak text offline via the device's built-in TTS, in her language when possible.
function speakOut(text: string) {
  try { speakLocal(text, readCachedProfile()?.language); } catch { /* ignore */ }
}

type Msg = { role: "system" | "user" | "assistant"; content: string };

export default function OfflineHelper() {
  const [state, setState] = useState<"idle" | "loading" | "ready" | "thinking">("idle");
  const [progress, setProgress] = useState(0);
  const [q, setQ] = useState("");
  const [answer, setAnswer] = useState("");
  const [needOnline, setNeedOnline] = useState(false);
  const [recording, setRecording] = useState(false);
  const [hearing, setHearing] = useState(false);
  const [reading, setReading] = useState(false);
  const [err, setErr] = useState("");
  const gen = useRef<((m: Msg[], o: Record<string, unknown>) => Promise<{ generated_text: Msg[] }[]>) | null>(null);
  const asr = useRef<((pcm: Float32Array) => Promise<{ text: string }>) | null>(null);
  const vlm = useRef<((msgs: unknown, o: Record<string, unknown>) => Promise<{ generated_text: string }[]>) | null>(null);
  const rec = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const kbRef = useRef<Kb | null>(null);
  const spokeRef = useRef(false);
  const photoInput = useRef<HTMLInputElement | null>(null);

  async function load() {
    setState("loading"); setErr("");
    try {
      const t = (await cdnImport(TRANSFORMERS)) as { pipeline: (...a: unknown[]) => Promise<unknown> };
      gen.current = (await t.pipeline("text-generation", MODEL, {
        dtype: "q4",
        device: "wasm",
        progress_callback: (p: { status?: string; progress?: number }) => {
          if (p.status === "progress" && typeof p.progress === "number") setProgress(Math.round(p.progress));
        },
      })) as typeof gen.current;
      setState("ready");
    } catch (e) {
      setErr("Couldn't load the offline helper. It needs one online download first."); setState("idle");
      console.error(e);
    }
  }

  // Is the tiny model's answer too weak to trust? (Kept loose — over-strict gating
  // made the offline chat feel dead: every answer got binned and she was told to
  // go online.)
  function weak(a: string): boolean {
    const t = (a || "").trim();
    if (t.length < 8) return true;
    if (/i (don'?t|do not) know|i'?m not sure|as an ai|cannot help|no puedo/i.test(t)) return true;
    const w = t.toLowerCase().split(/\s+/);
    if (w.length > 14 && new Set(w).size / w.length < 0.35) return true; // severe repetition only
    return false;
  }

  // Lazy-load the offline speech-to-text model, then record → transcribe → ask.
  async function toggleMic() {
    if (recording) { rec.current?.stop(); return; }
    // Silence our own voice first — otherwise the mic records the spoken reply and
    // the helper "hears itself" (repeated questions/answers on speakerphone).
    try { speechSynthesis.cancel(); } catch { /* ignore */ }
    setErr("");
    try {
      if (!asr.current) {
        setHearing(true);
        const t = (await cdnImport(TRANSFORMERS)) as { pipeline: (...a: unknown[]) => Promise<unknown> };
        asr.current = (await t.pipeline("automatic-speech-recognition", ASR_MODEL, { dtype: "q4", device: "wasm" })) as typeof asr.current;
        setHearing(false);
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const r = new MediaRecorder(stream);
      chunks.current = [];
      r.ondataavailable = (e) => { if (e.data.size) chunks.current.push(e.data); };
      r.onstop = async () => {
        stream.getTracks().forEach((tr) => tr.stop());
        setRecording(false); setHearing(true);
        try {
          const blob = new Blob(chunks.current, { type: r.mimeType || "audio/webm" });
          const said = (await asr.current!(await blobTo16k(blob)))?.text?.trim() || "";
          if (said) { setQ(said); spokeRef.current = true; await ask(said); }
        } catch { setErr("Couldn't hear that clearly — try again."); }
        setHearing(false);
      };
      rec.current = r; r.start(); setRecording(true);
    } catch { setErr("Microphone not available."); setHearing(false); }
  }

  // On-device photo reading: SmolVLM-256M via transformers.js (WASM/WebGPU). Lets her
  // point her camera at an ANC card / drug / test result and get a plain explanation —
  // fully offline once downloaded. Slower than the cloud path, so it's opt-in.
  async function onPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setErr(""); setNeedOnline(false); setAnswer(""); setReading(true);
    try {
      if (!vlm.current) {
        const t = (await cdnImport(TRANSFORMERS)) as { pipeline: (...a: unknown[]) => Promise<unknown> };
        vlm.current = (await t.pipeline("image-text-to-text", VLM_MODEL, {
          dtype: "q4", device: "wasm",
          progress_callback: (p: { status?: string; progress?: number }) => {
            if (p.status === "progress" && typeof p.progress === "number") setProgress(Math.round(p.progress));
          },
        })) as typeof vlm.current;
      }
      const url = URL.createObjectURL(file);
      const messages = [{
        role: "user",
        content: [
          { type: "image", image: url },
          { type: "text", text: "Read this photo for a Nigerian mother. Say simply what it is (ANC card, medicine, or test) and the key details. If anything looks worrying, tell her to see a health worker. Be brief." },
        ],
      }];
      const out = await vlm.current!(messages, { max_new_tokens: 160 });
      URL.revokeObjectURL(url);
      const txt = (out?.[0]?.generated_text || "").toString().split("Assistant:").pop()?.trim() || "";
      if (txt) { setAnswer(txt); if ("speechSynthesis" in window) speakOut(txt); }
      else setErr("Couldn't read that photo — try a clearer, well-lit one.");
    } catch (e2) {
      console.error(e2);
      setErr("Offline photo reading needs one online download first (use WiFi), or go online.");
    }
    setReading(false);
  }

  async function ask(override?: string) {
    const question = (override ?? q).trim();
    if (!question) return;
    setAnswer(""); setNeedOnline(false);
    const profile = readCachedProfile();
    const name = profile?.firstName || "mama";
    const spoke = spokeRef.current; spokeRef.current = false;

    // 1) Danger words → skip the tiny model, give the reliable rule-based guidance.
    const danger = detectDangerSign(question);
    if (danger) {
      const reply = dangerReply(name, danger);
      setAnswer(reply); setNeedOnline(danger.level === "emergency");
      if (spoke) speakOut(danger.level === "emergency" ? "Please go to the nearest hospital now." : "Please go to your clinic today.");
      return;
    }

    // 2) On-device knowledge base — curated Nigerian maternal answers, no model, no
    //    network needed. A strong match answers directly; a weaker one grounds the model.
    if (!kbRef.current) kbRef.current = await loadKb();
    const hit = kbRef.current ? retrieve(kbRef.current, question) : null;
    if (hit && hit.score >= 6) {
      setAnswer(hit.item.a); if (spoke) speakOut(hit.item.a);
      return;
    }
    const grounding = hit && hit.score >= 3 ? hit.item.a : "";

    // No model yet: if we have a decent curated match, use it; else send her online.
    if (!gen.current) {
      if (grounding) { setAnswer(grounding); if (spoke) speakOut(grounding); }
      else setNeedOnline(true);
      return;
    }
    setState("thinking");
    try {
      const ctx = profile ? ` She is ${name}, in week ${profile.week} (${profile.trimester} trimester)${profile.firstPregnancy ? ", first pregnancy" : ""}.` : "";
      const groundLine = grounding ? ` Use this trusted note to answer: "${grounding}"` : "";
      const messages: Msg[] = [
        { role: "system", content: `You are Bumply, a kind pregnancy helper for Nigerian mothers.${ctx} Answer in 1-2 short, simple sentences.${groundLine} For any warning sign (bleeding, severe pain, baby not moving, fits, fever), tell her to go to a clinic now. If you are unsure, say "I'm not sure".` },
        { role: "user", content: question },
      ];
      // Sampling + repetition penalty: greedy decoding makes a 135M model loop the
      // same phrase, which then failed the weak() gate — the chat felt broken.
      const out = await gen.current(messages, { max_new_tokens: 70, do_sample: true, temperature: 0.7, top_p: 0.9, repetition_penalty: 1.3 });
      const reply = (out?.[0]?.generated_text?.at?.(-1)?.content || "").trim();
      // Weak model answer → curated note if we have one; else the closest KB item;
      // only push her online as a last resort.
      if (weak(reply)) {
        const backup = grounding || (hit && hit.score > 0 ? hit.item.a : "");
        if (backup) { setAnswer(backup); if (spoke) speakOut(backup); }
        else setNeedOnline(true);
      } else { setAnswer(reply); if (spoke) speakOut(reply); }
    } catch {
      setNeedOnline(true);
    }
    setState("ready");
  }

  const canAsk = state === "ready" || state === "idle";
  return (
    <div className="card" style={{ marginTop: 8 }}>
      <p className="s-label">Ask a question — works without network</p>
      <p className="muted" style={{ fontSize: 13, marginTop: 2, marginBottom: 6 }}>Tap the 🎤 and talk, or type. You can also read a photo of your card or medicine.</p>

      {/* Input is always available — danger-sign checks + "go online" work even before
          the model is downloaded. */}
      <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
        <button onClick={toggleMic} title="Speak" aria-label="Speak"
          style={{ flex: "0 0 44px", borderRadius: 10, border: "1px solid var(--border)", cursor: "pointer", fontSize: 18, background: recording ? "var(--pink)" : "white", color: recording ? "#fff" : "inherit" }}
          disabled={state === "thinking" || hearing}>
          {hearing ? "⏳" : recording ? "■" : "🎤"}
        </button>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={hearing ? "Listening…" : "Ask, or tap 🎤 to speak…"} onKeyDown={(e) => e.key === "Enter" && ask()} style={{ flex: 1, padding: "10px 12px", borderRadius: 10, border: "1px solid var(--border)", fontSize: 14 }} disabled={state === "thinking" || state === "loading"} />
        <button className="f-submit" style={{ maxWidth: 80 }} onClick={() => ask()} disabled={!canAsk}>{state === "thinking" ? "…" : "Ask"}</button>
      </div>

      {/* On-device photo reading (ANC card / medicine / test result). */}
      <input ref={photoInput} type="file" accept="image/*" capture="environment" onChange={onPhoto} style={{ display: "none" }} />
      <button onClick={() => photoInput.current?.click()} disabled={reading || state === "thinking"}
        style={{ marginTop: 8, width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px dashed var(--border)", background: "white", cursor: "pointer", fontSize: 13 }}>
        {reading ? `Reading your photo… ${progress ? progress + "%" : ""}` : "📷 Read a photo (ANC card, medicine, test) — offline"}
      </button>

      {state === "idle" && (
        <div style={{ marginTop: 10 }}>
          <p className="muted" style={{ fontSize: 13 }}>Danger-sign checks and common answers work now, offline.</p>
          <button onClick={load} style={{ marginTop: 8, width: "100%", minHeight: 44, padding: "10px 12px", borderRadius: 10, border: "1px dashed var(--pink)", background: "var(--pink-pale)", color: "var(--pink)", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
            ⬇️ Add the offline helper <span style={{ fontWeight: 400 }}>(one-time, use WiFi)</span>
          </button>
        </div>
      )}
      {state === "loading" && <p className="muted" style={{ marginTop: 10 }}>Downloading the offline helper… {progress}%</p>}

      {answer && <p style={{ marginTop: 12, fontSize: 14, lineHeight: 1.6, whiteSpace: "pre-line" }}>{answer}</p>}

      {needOnline && (
        <div style={{ marginTop: 12, padding: "12px 14px", background: "var(--gold-lt)", border: "1px solid var(--gold)", borderRadius: 12 }}>
          <p style={{ fontSize: 13, marginBottom: 10 }}>I can&apos;t answer this fully offline. When you have network, ask the full Bumply for a proper answer.</p>
          <a className="f-submit" href="/chat" style={{ display: "inline-flex", maxWidth: 200, textDecoration: "none", alignItems: "center", justifyContent: "center" }}>💬 Ask full Bumply (online)</a>
        </div>
      )}

      {(state === "ready" || answer) && <p className="muted" style={{ fontSize: 11, marginTop: 10 }}>Runs on your phone. Basic guidance, not a diagnosis.</p>}
      {err && <p style={{ color: "var(--pink)", fontSize: 13, marginTop: 8 }}>{err}</p>}
    </div>
  );
}
