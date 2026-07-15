"use client";
import { useEffect, useState } from "react";
import { LANGUAGES, normalizeLang } from "@/lib/languages";
import { t } from "@/lib/i18n";
import { speakLocal, startLocalAsr, localAsrSupported } from "@/lib/localVoice";

const WEEKS = Array.from({ length: 40 }, (_, i) => i + 1);

// --- Voice sign-up helpers (on-device, no network) ---
const UNITS: Record<string, number> = { zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19 };
const TENS: Record<string, number> = { twenty: 20, thirty: 30, forty: 40 };

// Parse a spoken week: digits ("20 weeks") or number words ("twenty four").
function parseWeekLocal(s: string): number {
  const d = s.match(/\b(\d{1,2})\b/);
  if (d) { const n = Number(d[1]); if (n >= 1 && n <= 42) return n; }
  let total = 0;
  for (const w of s.toLowerCase().split(/[\s-]+/)) { if (w in UNITS) total += UNITS[w]; else if (w in TENS) total += TENS[w]; }
  return total >= 1 && total <= 42 ? total : 0;
}

// Clean a spoken name: drop lead-ins, keep letters, title-case, max 2 words.
function cleanNameLocal(s: string): string {
  return s
    .replace(/^\s*(my\s+name\s+is|i\s*am|i'?m|call\s+me|na\s+me|na)\s+/i, "")
    .replace(/[^\p{L}\s'-]/gu, "")
    .trim()
    .split(/\s+/).slice(0, 2)
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ")
    .trim();
}
const ETHNICITIES = [
  "Yoruba", "Igbo", "Hausa", "Fulani", "Ijaw", "Kanuri", "Tiv", "Ibibio / Efik",
  "Edo", "Nupe", "Urhobo", "Non-Nigerian", "Prefer not to say", "Other",
];

export default function RegisterForm() {
  const [form, setForm] = useState({
    full_name: "",
    partner_name: "",
    email: "",
    password: "",
    phone: "",
    due_date: "",
    current_week: "",
    first_pregnancy: "yes",
    dietary_restrictions: "",
    ethnicity: "",
    language: "en",
  });
  const [otherEth, setOtherEth] = useState("");
  const [showMore, setShowMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [canVoice, setCanVoice] = useState(false); // set after mount to avoid hydration mismatch
  const [voiceActive, setVoiceActive] = useState(false);

  const L = normalizeLang(form.language);
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => { setCanVoice(localAsrSupported()); }, []);

  // Speak a prompt, then capture one spoken answer on-device. Resolves with the text.
  function listenOnce(prompt: string): Promise<string> {
    return new Promise((resolve) => {
      speakLocal(prompt, L).then(() => {
        let done2 = false;
        let handle: { stop: () => void } | null = null;
        handle = startLocalAsr(
          L,
          (tx) => { if (!done2) { done2 = true; resolve(tx); } handle?.stop(); },
          () => { if (!done2) { done2 = true; resolve(""); } },
        );
        if (!handle) resolve("");
      });
    });
  }

  // Voice sign-up: ask her name, then her weeks — no typing needed.
  async function voiceSignup() {
    if (!localAsrSupported()) { setError(t("reg.voiceUnsupported", L)); return; }
    setError(""); setVoiceActive(true);
    try {
      const nm = cleanNameLocal(await listenOnce(t("reg.vName", L)));
      if (nm) set("full_name", nm);
      const wk = parseWeekLocal(await listenOnce(t("reg.vWeek", L)));
      if (wk) set("current_week", String(wk));
      await speakLocal(t("reg.vDone", L), L);
    } catch { /* ignore */ }
    setVoiceActive(false);
  }

  async function submit() {
    setError("");
    // Keep it light: just name, contact, password and how far along she is. A due
    // date is optional — many mothers know weeks/months better than an exact date.
    if (!form.full_name || !form.email || !form.password || !form.current_week) {
      setError(t("reg.errRequired", L));
      return;
    }
    if (form.password.length < 8) {
      setError(t("reg.errPw", L));
      return;
    }
    setBusy(true);
    try {
      const ethnicity = form.ethnicity === "Other" ? otherEth.trim() : form.ethnicity;
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, ethnicity, current_week: parseInt(form.current_week, 10), source: "website" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Registration failed");
      setDone(true);
      setTimeout(() => (window.location.href = "/dashboard"), 1200);
    } catch (e) {
      setBusy(false);
      setError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
    }
  }

  if (done) {
    return (
      <div className="form-card">
        <div className="f-success show">
          <div className="fs-icon">🌸</div>
          <h3 className="fs-title">{t("reg.successTitle", L)}</h3>
          <p className="fs-msg">{t("reg.successMsg", L)}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="form-card">
      <h3 className="fc-head">{t("reg.title", L)}</h3>
      <p className="fc-sub">{t("reg.sub", L)}</p>

      {/* Language FIRST — so the rest of the form is understood. */}
      <div className="fg">
        <label>🌍 {t("reg.language", L)}</label>
        <select value={form.language} onChange={(e) => set("language", e.target.value)}>
          {LANGUAGES.map((l) => (
            <option key={l.code} value={l.code}>{l.native}</option>
          ))}
        </select>
      </div>

      {/* Voice sign-up — speak your name + weeks, no typing. On-device, works for
          mothers who can't read/type. */}
      {canVoice && (
        <button type="button" onClick={voiceSignup} disabled={voiceActive}
          style={{ width: "100%", minHeight: 48, marginBottom: 14, padding: "12px", borderRadius: 12, border: `1.5px solid var(--pink)`, background: voiceActive ? "var(--pink)" : "var(--pink-pale)", color: voiceActive ? "#fff" : "var(--pink)", fontSize: 15, fontWeight: 700, cursor: "pointer" }}>
          {voiceActive ? `🎙 ${t("reg.vListening", L)}` : `🎤 ${t("reg.voiceBtn", L)}`}
        </button>
      )}
      <div className="fg">
        <label>{t("reg.name", L)}</label>
        <input value={form.full_name} onChange={(e) => set("full_name", e.target.value)} placeholder={t("reg.namePh", L)} />
      </div>
      <div className="fg">
        <label>{t("reg.phone", L)}</label>
        <input type="tel" inputMode="tel" value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+234 800 000 0000" />
      </div>
      <div className="fg">
        <label>{t("reg.week", L)}</label>
        <select value={form.current_week} onChange={(e) => set("current_week", e.target.value)}>
          <option value="" disabled>{t("reg.weekSel", L)}</option>
          {WEEKS.map((w) => (
            <option key={w} value={w}>{t("dash.week", L)} {w}</option>
          ))}
        </select>
      </div>
      <div className="fg">
        <label>{t("reg.email", L)}</label>
        <input type="email" inputMode="email" value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="amara@email.com" />
      </div>
      <div className="fg">
        <label>{t("reg.password", L)}</label>
        <input type="password" value={form.password} onChange={(e) => set("password", e.target.value)} placeholder={t("reg.passwordPh", L)} />
      </div>

      {/* Everything else is optional — hidden by default to keep the form short. */}
      <button type="button" onClick={() => setShowMore((s) => !s)} className="auth-link" style={{ background: "none", border: "none", padding: "4px 0", fontSize: 14, cursor: "pointer", fontWeight: 600 }}>
        {showMore ? "▲" : "▼"} {t("reg.more", L)}
      </button>
      {showMore && (
        <div style={{ marginTop: 8 }}>
          <div className="fg">
            <label>Partner&apos;s name (optional)</label>
            <input value={form.partner_name} onChange={(e) => set("partner_name", e.target.value)} placeholder="David" />
          </div>
          <div className="fg">
            <label>Due date (optional)</label>
            <input type="date" value={form.due_date} onChange={(e) => set("due_date", e.target.value)} />
          </div>
          <div className="fg">
            <label>Is this your first pregnancy?</label>
            <select value={form.first_pregnancy} onChange={(e) => set("first_pregnancy", e.target.value)}>
              <option value="yes">Yes — first time 🌸</option>
              <option value="no">No — I&apos;ve done this before</option>
            </select>
          </div>
          <div className="fg">
            <label>Ethnicity (for your meal plan)</label>
            <select value={form.ethnicity} onChange={(e) => set("ethnicity", e.target.value)}>
              <option value="">Select (so we curate local meals)</option>
              {ETHNICITIES.map((e) => (
                <option key={e} value={e}>{e}</option>
              ))}
            </select>
            {form.ethnicity === "Other" && (
              <input style={{ marginTop: 8 }} value={otherEth} onChange={(e) => setOtherEth(e.target.value)} placeholder="Type your ethnicity / cuisine" />
            )}
          </div>
          <div className="fg">
            <label>Dietary restrictions (optional)</label>
            <input value={form.dietary_restrictions} onChange={(e) => set("dietary_restrictions", e.target.value)} placeholder="e.g. vegetarian, no nuts, lactose intolerant" />
          </div>
        </div>
      )}

      <button className="f-submit" onClick={submit} disabled={busy}>
        {busy ? t("reg.submitting", L) : t("reg.submit", L)}
      </button>
      {error && <p className="f-error">{error}</p>}
      <p className="f-note">{t("reg.freeNote", L)}</p>
    </div>
  );
}
