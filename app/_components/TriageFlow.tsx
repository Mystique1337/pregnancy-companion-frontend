"use client";
import { useState } from "react";
import { SYMPTOMS, assessTriage, LEVEL_COPY, TRIAGE_DISCLAIMER, type TriageLevel } from "@/lib/triage";

const TONE: Record<"pink" | "gold" | "sage", { border: string; bg: string }> = {
  pink: { border: "var(--pink)", bg: "var(--pink-pale)" },
  gold: { border: "var(--gold)", bg: "var(--gold-lt)" },
  sage: { border: "var(--lavender)", bg: "var(--lav-pale)" },
};

export default function TriageFlow() {
  const [symptomId, setSymptomId] = useState<string | null>(null);
  const [yes, setYes] = useState<Record<string, boolean>>({});
  const [outcome, setOutcome] = useState<{ level: TriageLevel; symptomId: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const symptom = SYMPTOMS.find((s) => s.id === symptomId) || null;

  function pick(id: string) {
    setSymptomId(id);
    setYes({});
    setOutcome(null);
  }

  function reset() {
    setSymptomId(null);
    setYes({});
    setOutcome(null);
  }

  async function assess() {
    if (!symptom) return;
    const yesIds = symptom.questions.filter((q) => yes[q.id]).map((q) => q.id);
    const res = assessTriage(symptom.id, yesIds);
    if (!res) return;
    setOutcome({ level: res.level, symptomId: symptom.id });
    // Log server-side (recomputed) so red flags reach the clinician + notifications.
    setBusy(true);
    fetch("/api/triage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ symptomId: symptom.id, yes: yesIds }),
    }).catch(() => {}).finally(() => setBusy(false));
  }

  // ── Outcome ──
  if (outcome && symptom) {
    const copy = LEVEL_COPY[outcome.level];
    const tone = TONE[copy.tone];
    const showTips = (outcome.level === "caution" || outcome.level === "selfcare") && symptom.tips?.length;
    const showHospital = outcome.level === "emergency" || outcome.level === "urgent";
    return (
      <div>
        <div className="card" style={{ border: `1.5px solid ${tone.border}`, background: tone.bg, marginBottom: 20 }}>
          <p className="s-label" style={{ marginBottom: 8 }}>{symptom.emoji} {symptom.label}</p>
          <h2 className="feat-title" style={{ marginBottom: 10, fontSize: 24 }}>{copy.title}</h2>
          <p style={{ marginBottom: showHospital ? 18 : 6, lineHeight: 1.6 }}>{copy.action}</p>
          {showHospital && (
            <a className="f-submit" href="/hospitals" style={{ display: "inline-flex", maxWidth: 240, textDecoration: "none", alignItems: "center", justifyContent: "center" }}>
              🏥 Find hospitals near me
            </a>
          )}
        </div>

        {showTips && (
          <div className="card" style={{ marginBottom: 20 }}>
            <p className="s-label">What can help</p>
            <ul style={{ margin: "10px 0 0", paddingLeft: 20, lineHeight: 1.8, color: "var(--ink-mid)", fontSize: 14 }}>
              {symptom.tips!.map((tip, i) => <li key={i}>{tip}</li>)}
            </ul>
          </div>
        )}

        <p className="muted" style={{ fontSize: 12, marginBottom: 18 }}>
          {TRIAGE_DISCLAIMER}{busy ? " · saving…" : ""}
        </p>
        <button className="btn-ghost" onClick={reset} style={{ display: "inline-flex" }}>Check another symptom</button>
      </div>
    );
  }

  // ── Questions for the chosen symptom ──
  if (symptom) {
    return (
      <div>
        <button className="btn-ghost btn-back" onClick={reset} style={{ display: "inline-flex", marginBottom: 16 }}>← All symptoms</button>
        <div className="card">
          <p className="s-label">{symptom.emoji} {symptom.label}</p>
          {symptom.lead && <p className="muted" style={{ margin: "8px 0 18px", fontSize: 14 }}>{symptom.lead}</p>}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {symptom.questions.map((q) => {
              const on = !!yes[q.id];
              return (
                <button
                  key={q.id}
                  onClick={() => setYes((p) => ({ ...p, [q.id]: !p[q.id] }))}
                  style={{
                    textAlign: "left", cursor: "pointer", padding: "13px 14px", borderRadius: 12,
                    border: `1.5px solid ${on ? "var(--pink)" : "var(--border)"}`,
                    background: on ? "var(--pink-pale)" : "white",
                    display: "flex", alignItems: "center", gap: 12, fontSize: 14, color: "var(--ink)",
                  }}
                >
                  <span style={{
                    flex: "0 0 22px", width: 22, height: 22, borderRadius: 6, display: "inline-flex", alignItems: "center", justifyContent: "center",
                    border: `1.5px solid ${on ? "var(--pink)" : "var(--ink-muted)"}`, background: on ? "var(--pink)" : "transparent", color: "white", fontSize: 13,
                  }}>{on ? "✓" : ""}</span>
                  {q.text}
                </button>
              );
            })}
          </div>
          <p className="muted" style={{ fontSize: 12, margin: "16px 0 0" }}>Tap the ones that are true for you right now, then continue. Tap none if none apply.</p>
          <button className="f-submit" onClick={assess} style={{ marginTop: 18, maxWidth: 220 }}>See guidance</button>
        </div>
      </div>
    );
  }

  // ── Symptom picker ──
  return (
    <div>
      <p className="muted" style={{ marginBottom: 18 }}>What are you noticing? Pick the closest one.</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 12 }}>
        {SYMPTOMS.map((s) => (
          <button
            key={s.id}
            onClick={() => pick(s.id)}
            className="card"
            style={{ cursor: "pointer", padding: "18px 14px", textAlign: "center", display: "flex", flexDirection: "column", gap: 8, alignItems: "center", transition: "border-color .15s, transform .15s" }}
          >
            <span style={{ fontSize: 30, lineHeight: 1 }}>{s.emoji}</span>
            <span style={{ fontSize: 14, color: "var(--ink)", lineHeight: 1.3 }}>{s.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
