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
  const [pendingVoiceSend, setPendingVoiceSend] = useState<string | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const localRecRef = useRef<{ stop: () => void } | null>(null);

  useEffect(() => {
    if (boxRef.current) boxRef.current.scrollTop = boxRef.current.scrollHeight;
  }, [msgs, busy]);

  // Tap to talk: record → transcribe → auto-send. Prefers server Whisper (best,
  // supports her language); when offline, uses the phone's on-device recognition.
  async function toggleMic() {
    if (recording) { localRecRef.current?.stop(); recRef.current?.stop(); return; }
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

  // Read a reply aloud in her language. Prefers server SoroTTS (best quality);
  // falls back to the phone's on-device voice when the server is unreachable/offline.
  // Tapping again stops playback.
  async function playMsg(i: number, text: string) {
    if (voiceMsg === i) { audioRef.current?.pause(); audioRef.current = null; stopLocalTts(); setVoiceMsg(null); return; }
    audioRef.current?.pause(); stopLocalTts();
    setVoiceMsg(i);
    if (navigator.onLine) {
      try {
        const res = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, voice: L }),
        });
        if (res.ok) {
          const url = URL.createObjectURL(await res.blob());
          const audio = new Audio(url);
          audioRef.current = audio;
          audio.onended = () => { URL.revokeObjectURL(url); setVoiceMsg(null); };
          await audio.play();
          return; // keep the "playing" state until it ends
        }
      } catch { /* server voice unavailable → local fallback below */ }
    }
    // On-device voice (no network / server down).
    await speakLocal(text, L);
    setVoiceMsg(null);
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
                {voiceMsg === i ? `⏹ ${t("chat.stop", L)}` : `🔊 ${t("chat.listen", L)}`}
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
