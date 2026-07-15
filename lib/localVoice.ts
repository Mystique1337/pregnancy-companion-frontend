// On-device voice via the browser's built-in engines — NO network, NO Modal bill.
// Used as a fallback when the server voice (SoroTTS/Whisper on Modal) is unreachable
// or the phone is offline, so a mother can always talk to and hear Bumply.
//   • Text-to-speech  → Web Speech `speechSynthesis`
//   • Speech-to-text  → Web Speech `SpeechRecognition` (Chrome/Android)
// Local engines rarely support yo/ha/ig, so those map to en-NG for recognition;
// the higher-quality server path handles her language when she's online.

type Lang = string | null | undefined;

// Map our app language to a BCP-47 tag the browser engines understand.
export function voiceLangTag(lang: Lang): string {
  switch ((lang || "en").toLowerCase()) {
    case "yo": return "yo-NG";
    case "ha": return "ha-NG";
    case "ig": return "ig-NG";
    case "pcm": return "en-NG";
    default: return "en-NG";
  }
}

export function localTtsSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

// Speak text on-device. Tries to pick a voice matching her language, else falls
// back to any English voice. Resolves when speech ends (or immediately if unsupported).
export function speakLocal(text: string, lang?: Lang): Promise<void> {
  return new Promise((resolve) => {
    if (!localTtsSupported() || !text.trim()) return resolve();
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text.slice(0, 500));
      const tag = voiceLangTag(lang);
      const voices = window.speechSynthesis.getVoices();
      const pref = tag.split("-")[0];
      const match =
        voices.find((v) => v.lang?.toLowerCase() === tag.toLowerCase()) ||
        voices.find((v) => v.lang?.toLowerCase().startsWith(pref)) ||
        voices.find((v) => v.lang?.toLowerCase().startsWith("en"));
      if (match) u.voice = match;
      u.lang = match?.lang || tag;
      u.rate = 0.96;
      u.onend = () => resolve();
      u.onerror = () => resolve();
      window.speechSynthesis.speak(u);
    } catch {
      resolve();
    }
  });
}

export function stopLocalTts() {
  try { if (localTtsSupported()) window.speechSynthesis.cancel(); } catch { /* ignore */ }
}

type SpeechRecognitionLike = {
  lang: string; continuous: boolean; interimResults: boolean;
  start: () => void; stop: () => void; abort: () => void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: (() => void) | null; onend: (() => void) | null;
};

function getRecognitionCtor(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike; webkitSpeechRecognition?: new () => SpeechRecognitionLike };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

export function localAsrSupported(): boolean {
  return getRecognitionCtor() !== null;
}

// Start on-device speech recognition. Returns a stop() handle, or null if unsupported.
// onResult fires with the final transcript; onEnd fires when it stops.
export function startLocalAsr(
  lang: Lang,
  onResult: (text: string) => void,
  onEnd?: () => void,
): { stop: () => void } | null {
  const Ctor = getRecognitionCtor();
  if (!Ctor) return null;
  try {
    const rec = new Ctor();
    rec.lang = voiceLangTag(lang);
    rec.continuous = false;
    rec.interimResults = false;
    rec.onresult = (e) => {
      let out = "";
      for (let i = 0; i < e.results.length; i++) out += e.results[i][0].transcript;
      const t = out.trim();
      if (t) onResult(t);
    };
    rec.onerror = () => onEnd?.();
    rec.onend = () => onEnd?.();
    rec.start();
    return { stop: () => { try { rec.stop(); } catch { /* ignore */ } } };
  } catch {
    return null;
  }
}
