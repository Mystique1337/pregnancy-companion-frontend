"use client";
import { useState } from "react";
import { MOOD_QUESTIONS, MOOD_BAND_COLOR, type MoodResult } from "@/lib/mood";

export default function WellbeingCheck() {
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [result, setResult] = useState<MoodResult | null>(null);
  const [busy, setBusy] = useState(false);
  const answered = Object.keys(answers).length;
  const total = MOOD_QUESTIONS.length;

  async function submit() {
    setBusy(true);
    const res = await fetch("/api/wellbeing", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ answers }) });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    if (d.result) setResult(d.result);
  }

  if (result) {
    const c = MOOD_BAND_COLOR[result.band];
    const showHelp = result.band === "elevated" || result.band === "urgent";
    return (
      <div>
        <div className="card" style={{ border: `1.5px solid ${c.border}`, background: c.bg, marginBottom: 18 }}>
          <h2 className="feat-title" style={{ marginBottom: 10, fontSize: 22 }}>{result.title}</h2>
          <p style={{ lineHeight: 1.6, marginBottom: showHelp ? 14 : 0 }}>{result.message}</p>
          {showHelp && (
            <a className="f-submit" href="/chat" style={{ display: "inline-flex", maxWidth: 220, textDecoration: "none", alignItems: "center", justifyContent: "center" }}>
              💬 Talk to Bumply now
            </a>
          )}
        </div>
        <p className="muted" style={{ fontSize: 12, marginBottom: 16 }}>
          This is a wellbeing screen, not a diagnosis. If you ever feel you might harm yourself, please contact a clinic or helpline right away.
        </p>
        <button className="btn-ghost btn-back" onClick={() => { setResult(null); setAnswers({}); }}>Take it again</button>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {MOOD_QUESTIONS.map((q, qi) => (
          <div key={q.id} className="card">
            <p style={{ fontSize: 15, marginBottom: 10 }}><span className="muted" style={{ fontSize: 13 }}>{qi + 1}. </span>{q.text}</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {q.options.map((o) => {
                const on = answers[q.id] === o.value;
                return (
                  <button
                    key={o.value}
                    onClick={() => setAnswers((p) => ({ ...p, [q.id]: o.value }))}
                    style={{ textAlign: "left", cursor: "pointer", padding: "10px 12px", borderRadius: 10, fontSize: 14,
                      border: `1.5px solid ${on ? "var(--pink)" : "var(--border)"}`, background: on ? "var(--pink-pale)" : "white", color: "var(--ink)" }}
                  >
                    {o.label}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <div style={{ position: "sticky", bottom: 16, marginTop: 18 }}>
        <button className="f-submit" onClick={submit} disabled={busy || answered < total} style={{ width: "100%" }}>
          {busy ? "Checking…" : answered < total ? `Answer all ${total} (${answered}/${total})` : "See my result"}
        </button>
      </div>
    </div>
  );
}
