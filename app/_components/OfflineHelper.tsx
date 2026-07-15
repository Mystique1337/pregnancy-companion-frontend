"use client";
// Experimental on-device AI helper: SmolLM2-135M-Instruct (~135M params) running
// fully in the browser via transformers.js (WASM). Opt-in (~100MB one-time
// download, cached), then answers offline. Basic quality — the deterministic
// danger-sign checker above is the safety layer; this is a bonus for free chat
// when there's no signal.
import { useRef, useState } from "react";

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

  async function ask() {
    if (!gen.current || !q.trim()) return;
    setState("thinking"); setAnswer("");
    try {
      const messages: Msg[] = [
        { role: "system", content: "You are Bumply, a kind pregnancy helper for Nigerian mothers. Answer in 1-2 short, simple sentences. For any warning sign (bleeding, severe pain, baby not moving, fits, fever), tell her to go to a clinic now." },
        { role: "user", content: q.trim() },
      ];
      const out = await gen.current(messages, { max_new_tokens: 80, do_sample: false, temperature: 0.3 });
      const last = out?.[0]?.generated_text?.at?.(-1);
      setAnswer((last?.content || "I'm here with you. If something feels wrong, please see your clinic.").trim());
    } catch {
      setAnswer("Sorry, I couldn't answer that offline. If something feels wrong, please see your clinic.");
    }
    setState("ready");
  }

  return (
    <div className="card" style={{ marginTop: 8 }}>
      <p className="s-label">Ask offline (experimental)</p>
      {state === "idle" && (
        <>
          <p className="muted" style={{ fontSize: 13, marginBottom: 12 }}>
            A tiny AI helper that works with no network. First use downloads ~100MB (use WiFi) — after that it answers offline. Basic answers; not a doctor.
          </p>
          <button className="btn-ghost btn-back" onClick={load}>Download offline helper</button>
        </>
      )}
      {state === "loading" && <p className="muted">Downloading the offline helper… {progress}%</p>}
      {(state === "ready" || state === "thinking") && (
        <>
          <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ask a quick question…" onKeyDown={(e) => e.key === "Enter" && ask()} style={{ flex: 1, padding: "10px 12px", borderRadius: 10, border: "1px solid var(--border)", fontSize: 14 }} disabled={state === "thinking"} />
            <button className="f-submit" style={{ maxWidth: 90 }} onClick={ask} disabled={state === "thinking"}>{state === "thinking" ? "…" : "Ask"}</button>
          </div>
          {answer && <p style={{ marginTop: 12, fontSize: 14, lineHeight: 1.6 }}>{answer}</p>}
          <p className="muted" style={{ fontSize: 11, marginTop: 10 }}>Runs on your phone, offline. Basic guidance, not a diagnosis.</p>
        </>
      )}
      {err && <p style={{ color: "var(--pink)", fontSize: 13, marginTop: 8 }}>{err}</p>}
    </div>
  );
}
