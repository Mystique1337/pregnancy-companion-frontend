"use client";
import { useEffect, useRef, useState } from "react";
import { normalizeLang } from "@/lib/languages";
import { t } from "@/lib/i18n";
import { speakLocal, stopLocalTts, startLocalAsr, localAsrSupported } from "@/lib/localVoice";

type Msg = { role: "user" | "assistant"; content: string };

export default function ChatPanel({
  name,
  initial,
  suggestions,
  lang,
}: {
  name: string;
  initial: Msg[];
  suggestions: string[];
  lang?: string | null;
}) {
  const L = normalizeLang(lang);
  const [msgs, setMsgs] = useState<Msg[]>(initial);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [voiceMsg, setVoiceMsg] = useState<number | null>(null);
  const [voiceStage, setVoiceStage] = useState<"loading" | "playing" | null>(null);
  const ttsAbort = useRef<AbortController | null>(null);
  const userCancelledTts = useRef(false);
  const [pendingVoiceSend, setPendingVoiceSend] = useState<string | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const localRecRef = useRef<{ stop: () => void } | null>(null);

  useEffect(() => {
    if (boxRef.current) boxRef.current.scrollTop = boxRef.current.scrollHeight;
  }, [msgs, busy]);

  // Wake SoroTTS (the Nigerian voices on Modal) the moment she opens the chat, so
  // the first "Listen" is her voice, fast — not a cold start.
  useEffect(() => {
    fetch("/api/voice/warm", { method: "POST" }).catch(() => {});
  }, []);

  // Tap to talk: record → transcribe → auto-send. Prefers server Whisper (best,
  // supports her language); when offline, uses the phone's on-device recognition.
  async function toggleMic() {
    if (recording) { localRecRef.current?.stop(); recRef.current?.stop(); return; }
    // CRITICAL: silence any playing reply first — on speakerphone the mic would
    // record Bumply's own voice, Whisper would transcribe it as her next question,
    // and the chat would loop, repeating questions and answers.
    stopVoice();
    // Offline → on-device speech recognition (no network, no Modal).
    if (!navigator.onLine && localAsrSupported()) {
      const handle = startLocalAsr(
        L,
        (tx) => { if (tx.length > 1) setPendingVoiceSend(tx); },
        () => { setRecording(false); localRecRef.current = null; },
      );
      if (handle) { localRecRef.current = handle; setRecording(true); return; }
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = (e) => { if (e.data.size) chunksRef.current.push(e.data); };
      rec.onstop = async () => {
        stream.getTracks().forEach((tr) => tr.stop());
        setRecording(false);
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" });
        if (blob.size < 800) return;
        setTranscribing(true);
        try {
          const form = new FormData();
          form.append("file", blob, "clip.webm");
          const res = await fetch("/api/asr", { method: "POST", body: form });
          const data = await res.json().catch(() => ({}));
          const tx = String(data.text || "").trim();
          // Voice-first: if she spoke a real question, send it and speak the reply
          // back — a hands-free conversation in her language (no typing needed).
          if (tx.length > 1) setPendingVoiceSend(tx);
          else if (tx) setInput((cur) => (cur ? cur + " " : "") + tx);
        } catch { /* ignore */ }
        setTranscribing(false);
      };
      recRef.current = rec;
      rec.start();
      setRecording(true);
    } catch { /* mic denied/unavailable */ }
  }

  // Read a reply aloud in HER voice — SoroTTS (Nigerian English/languages) is the
  // product's voice and always comes first. If it's cold-starting we WAIT and show
  // "preparing your voice…" (tap to cancel); the phone's generic voice is only a
  // last resort when SoroTTS genuinely fails or she's offline.
  async function playMsg(i: number, text: string) {
    if (voiceMsg === i) { stopVoice(); return; } // tap again = cancel/stop
    stopVoice();
    userCancelledTts.current = false;
    setVoiceMsg(i);
    if (navigator.onLine) {
      try {
        setVoiceStage("loading");
        const ctl = new AbortController();
        ttsAbort.current = ctl;
        const timer = setTimeout(() => ctl.abort(), 75000); // generous cold-start budget
        const res = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, voice: L }),
          signal: ctl.signal,
        });
        clearTimeout(timer);
        ttsAbort.current = null;
        if (res.ok) {
          const url = URL.createObjectURL(await res.blob());
          const audio = new Audio(url);
          audioRef.current = audio;
          setVoiceStage("playing");
          audio.onended = () => { URL.revokeObjectURL(url); setVoiceMsg(null); setVoiceStage(null); };
          await audio.play();
          return; // keep the "playing" state until it ends
        }
      } catch {
        ttsAbort.current = null;
        // She cancelled → stop silently; do NOT switch to the generic voice.
        if (userCancelledTts.current) return;
      }
    }
    // Last resort ONLY (offline / SoroTTS down): the phone's generic voice.
    setVoiceStage("playing");
    await speakLocal(text, L);
    setVoiceMsg(null); setVoiceStage(null);
  }

  function stopVoice() {
    userCancelledTts.current = true;
    ttsAbort.current?.abort(); ttsAbort.current = null;
    audioRef.current?.pause(); audioRef.current = null;
    stopLocalTts();
    setVoiceMsg(null); setVoiceStage(null);
  }

  async function send(text?: string, spoken = false) {
    const content = (text ?? input).trim();
    if (!content || busy) return;
    const next: Msg[] = [...msgs, { role: "user", content }];
    const assistantIdx = next.length; // slot the streamed reply will occupy
    setMsgs(next);
    setInput("");
    setBusy(true);

    let finalText = "";
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next }),
      });
      // Stream tokens into a single growing assistant message.
      setMsgs((m) => [...m, { role: "assistant", content: "" }]);
      const reader = res.body?.getReader();
      if (!reader) {
        finalText = await res.text();
        setMsgs((m) => replaceLast(m, finalText));
      } else {
        const dec = new TextDecoder();
        let acc = "";
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          acc += dec.decode(value, { stream: true });
          setMsgs((m) => replaceLast(m, acc));
        }
        finalText = acc;
      }
    } catch {
      setMsgs((m) => [...m, { role: "assistant", content: "I couldn't reach my thoughts just now — try again. 🌸" }]);
    } finally {
      setBusy(false);
    }
    // Voice-first: read the answer aloud in her language when she asked by voice.
    if (spoken && finalText.trim()) playMsg(assistantIdx, finalText.trim());
  }

  // Auto-send a transcribed voice question (hands-free), then speak the reply.
  useEffect(() => {
    if (pendingVoiceSend && !busy) {
      const tx = pendingVoiceSend;
      setPendingVoiceSend(null);
      send(tx, true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingVoiceSend]);

  return (
    <div className="card" style={{ padding: 0, overflow: "hidden", display: "flex", flexDirection: "column", height: "min(68dvh, 640px)" }}>
      <div ref={boxRef} className="np-messages" style={{ flex: 1, height: "auto" }}>
        {msgs.map((m, i) => (
          <div key={i} className={"np-msg " + (m.role === "user" ? "user" : "bumply")} style={{ maxWidth: "80%" }}>
            <div>{m.content || "…"}</div>
            {m.role === "assistant" && m.content && (
              <button
                className="np-listen"
                onClick={() => playMsg(i, m.content)}
                aria-label={voiceMsg === i ? t("chat.stop", L) : t("chat.listen", L)}
              >
                {voiceMsg === i
                  ? voiceStage === "loading"
                    ? `⏳ ${t("chat.voicePrep", L)}`
                    : `⏹ ${t("chat.stop", L)}`
                  : `🔊 ${t("chat.listen", L)}`}
              </button>
            )}
          </div>
        ))}
        {busy && msgs[msgs.length - 1]?.role === "user" && (
          <div className="np-typing"><span /><span /><span /></div>
        )}
      </div>

      {msgs.length <= 1 && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", padding: "12px 16px 0" }}>
          {suggestions.map((s) => (
            <button key={s} className="chip" style={{ cursor: "pointer", background: "var(--cream)" }} onClick={() => send(s)}>
              {s}
            </button>
          ))}
        </div>
      )}

      {(recording || transcribing) && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 16px 0", color: "var(--pink)", fontSize: 14, fontWeight: 600 }}>
          <span style={{ width: 9, height: 9, borderRadius: "50%", background: "var(--pink)", animation: recording ? "micPulse 1.1s infinite" : "none" }} />
          {recording ? `🎙 ${t("chat.listening", L)}` : `⏳ ${t("chat.transcribing", L)}`}
        </div>
      )}
      <div className="np-input-area">
        <button
          className={"np-send" + (recording ? " recording" : "")}
          onClick={toggleMic}
          aria-label={recording ? t("chat.stop", L) : t("chat.speak", L)}
          title={recording ? t("chat.stop", L) : t("chat.speak", L)}
          disabled={transcribing}
        >
          {transcribing ? "⏳" : recording ? "■" : "🎤"}
        </button>
        <input
          className="np-input"
          placeholder={transcribing ? `${t("chat.transcribing", L)}…` : `${t("chat.placeholder", L)}, ${name}…`}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          disabled={busy}
        />
        <button className="np-send" onClick={() => send()} aria-label={t("chat.send", L)} title={t("chat.send", L)} disabled={busy || !input.trim()}>→</button>
      </div>
    </div>
  );
}

function replaceLast(m: Msg[], content: string): Msg[] {
  const copy = [...m];
  copy[copy.length - 1] = { role: "assistant", content };
  return copy;
}
