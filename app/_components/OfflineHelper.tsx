"use client";
// Experimental on-device AI helper: SmolLM2-135M-Instruct (~135M params) running
// fully in the browser via transformers.js (WASM). Opt-in (~100MB one-time
// download, cached), then answers offline. Basic quality — the deterministic
// danger-sign checker above is the safety layer; this is a bonus for free chat
// when there's no signal.
import { useRef, useState } from "react";
import { detectDangerSign, dangerReply } from "@/lib/dangerSigns";
import { readCachedProfile } from "./ProfileCache";

// Runtime dynamic import from CDN, hidden from the bundler (keeps it out of the app bundle).
const cdnImport = (u: string) => (new Function("u", "return import(u)"))(u) as Promise<Record<string, unknown>>;
const TRANSFORMERS = "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.5.1";
const MODEL = "HuggingFaceTB/SmolLM2-135M-Instruct";

type Msg = { role: "system" | "user" | "assistant"; content: string };

export default function OfflineHelper() {
  const [state, setState] = useState<"idle" | "loading" | "ready" | "thinking">("idle");
  const [progress, setProgress] = useState(0);
  const [q, setQ] = useState("");
  const [answer, setAnswer] = useState("");
  const [needOnline, setNeedOnline] = useState(false);
  const [err, setErr] = useState("");
  const gen = useRef<((m: Msg[], o: Record<string, unknown>) => Promise<{ generated_text: Msg[] }[]>) | null>(null);

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

  // Is the tiny model's answer too weak to trust? Then redirect her online.
  function weak(a: string): boolean {
    const t = (a || "").trim();
    if (t.length < 8) return true;
    if (/i (don'?t|do not) know|i'?m not sure|as an ai|cannot help|no puedo/i.test(t)) return true;
    const w = t.toLowerCase().split(/\s+/);
    if (w.length > 10 && new Set(w).size / w.length < 0.5) return true; // repetitive
    return false;
  }

  async function ask() {
    if (!q.trim()) return;
    setAnswer(""); setNeedOnline(false);
    const profile = readCachedProfile();
    const name = profile?.firstName || "mama";

    // 1) Danger words → skip the tiny model, give the reliable rule-based guidance.
    const danger = detectDangerSign(q);
    if (danger) { setAnswer(dangerReply(name, danger)); setNeedOnline(danger.level === "emergency"); return; }

    if (!gen.current) return;
    setState("thinking");
    try {
      const ctx = profile ? ` She is ${name}, in week ${profile.week} (${profile.trimester} trimester)${profile.firstPregnancy ? ", first pregnancy" : ""}.` : "";
      const messages: Msg[] = [
        { role: "system", content: `You are Bumply, a kind pregnancy helper for Nigerian mothers.${ctx} Answer in 1-2 short, simple sentences. For any warning sign (bleeding, severe pain, baby not moving, fits, fever), tell her to go to a clinic now. If you are unsure, say "I'm not sure".` },
        { role: "user", content: q.trim() },
      ];
      const out = await gen.current(messages, { max_new_tokens: 80, do_sample: false, temperature: 0.3 });
      const reply = (out?.[0]?.generated_text?.at?.(-1)?.content || "").trim();
      // 2) Weak answer → redirect her to the full (online) Bumply.
      if (weak(reply)) { setAnswer(""); setNeedOnline(true); }
      else setAnswer(reply);
    } catch {
      setNeedOnline(true);
    }
    setState("ready");
  }

  const canAsk = state === "ready" || state === "idle";
  return (
    <div className="card" style={{ marginTop: 8 }}>
      <p className="s-label">Ask offline (experimental)</p>

      {/* Input is always available — danger-sign checks + "go online" work even before
          the model is downloaded. */}
      <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ask a quick question…" onKeyDown={(e) => e.key === "Enter" && ask()} style={{ flex: 1, padding: "10px 12px", borderRadius: 10, border: "1px solid var(--border)", fontSize: 14 }} disabled={state === "thinking" || state === "loading"} />
        <button className="f-submit" style={{ maxWidth: 90 }} onClick={ask} disabled={!canAsk}>{state === "thinking" ? "…" : "Ask"}</button>
      </div>

      {state === "idle" && (
        <p className="muted" style={{ fontSize: 12, marginTop: 10 }}>
          Danger-sign checks work now, offline. For other questions, <button onClick={load} style={{ background: "none", border: "none", color: "var(--pink)", cursor: "pointer", padding: 0, textDecoration: "underline", fontSize: 12 }}>download the tiny AI helper</button> (~100MB, use WiFi) or go online.
        </p>
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
