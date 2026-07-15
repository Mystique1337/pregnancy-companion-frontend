"use client";
import { useState } from "react";
import ChwDashboard from "./ChwDashboard";

type ChwMother = { id: string; full_name: string; phone: string | null; whatsapp_number: string | null; current_week: number; language: string | null; open_alerts: number; last_alert_at: string | null };

type Alert = {
  id: string; level: string; kind: string; message: string; status: string;
  created_at: string; full_name: string; email: string; phone: string | null; whatsapp_number: string | null;
  reviewed_by: string | null; outcome?: string | null;
};

type OutcomeStats = { total: number; with_outcome: number; sought_care: number };

const OUTCOME_LABEL: Record<string, string> = {
  sought_care: "✅ Reached care",
  referred: "🏥 Referred",
  ok: "🙂 She's okay",
  no_response: "📵 No response",
};

export default function ClinicAlerts({ clinicianName, alerts, chwMothers = [], stats }: { clinicianName: string; alerts: Alert[]; chwMothers?: ChwMother[]; stats?: OutcomeStats }) {
  const [busy, setBusy] = useState<string | null>(null);

  async function setStatus(id: string, status: string) {
    setBusy(id);
    await fetch("/api/clinic/alert", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    window.location.reload();
  }
  async function setOutcome(id: string, outcome: string) {
    setBusy(id);
    await fetch("/api/clinic/alert", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, outcome }),
    });
    window.location.reload();
  }
  async function logout() {
    await fetch("/api/clinic/logout", { method: "POST" });
    window.location.href = "/clinic/login";
  }

  const open = alerts.filter((a) => a.status === "open");
  const handled = alerts.filter((a) => a.status !== "open");

  const card = (a: Alert) => {
    const urgent = a.level === "urgent";
    const phone = a.whatsapp_number || a.phone;
    return (
      <div key={a.id} className="card" style={{ borderLeft: `5px solid ${urgent ? "var(--pink)" : "var(--gold)"}` }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <p style={{ fontFamily: "var(--serif)", fontSize: 18 }}>{urgent ? "🚨" : "⚠️"} {a.full_name}</p>
            <p className="muted" style={{ fontSize: 12 }}>
              {a.email}{phone ? ` · ${phone}` : ""} · {new Date(a.created_at).toLocaleString()}
            </p>
          </div>
          <span className={"badge " + (urgent ? "badge-premium" : "badge-free")} style={{ height: "fit-content" }}>{a.level}</span>
        </div>
        <p style={{ marginTop: 10 }}>{a.message}</p>
        {a.outcome && (
          <p style={{ marginTop: 8, fontSize: 13, fontWeight: 600, color: a.outcome === "no_response" ? "var(--ink-muted)" : "var(--green, #2e7d5b)" }}>
            Outcome: {OUTCOME_LABEL[a.outcome] || a.outcome}{a.reviewed_by ? ` · ${a.reviewed_by}` : ""}
          </p>
        )}
        <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
          {phone && <a className="btn-ghost" href={`https://wa.me/${phone.replace(/\D/g, "")}`} target="_blank">WhatsApp her</a>}
          {a.status === "open" ? (
            <button className="btn-ghost" onClick={() => setStatus(a.id, "reviewed")} disabled={busy === a.id}>Mark reviewed</button>
          ) : (
            !a.outcome && <button className="btn-ghost" onClick={() => setStatus(a.id, "open")} disabled={busy === a.id}>Reopen</button>
          )}
        </div>
        {/* Close-the-loop: record what actually happened. Available until an outcome is set. */}
        {!a.outcome && (
          <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px dashed var(--border)" }}>
            <p className="muted" style={{ fontSize: 12, marginBottom: 8 }}>Did she reach care? (records our real-world impact)</p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button className="btn-pink" onClick={() => setOutcome(a.id, "sought_care")} disabled={busy === a.id}>✅ Reached care</button>
              <button className="btn-ghost" onClick={() => setOutcome(a.id, "referred")} disabled={busy === a.id}>🏥 Referred</button>
              <button className="btn-ghost" onClick={() => setOutcome(a.id, "ok")} disabled={busy === a.id}>🙂 She&apos;s okay</button>
              <button className="btn-ghost" onClick={() => setOutcome(a.id, "no_response")} disabled={busy === a.id}>📵 No response</button>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      <div className="app-bar">
        <div className="app-bar-inner">
          <div className="logo"><div className="logo-dot" />Bumply <span style={{ color: "var(--ink-muted)", fontSize: 13, marginLeft: 4 }}>Clinic</span></div>
          <div className="app-nav">
            <span className="muted" style={{ fontSize: 13 }}>Dr {clinicianName}</span>
            <button className="btn-ghost" onClick={logout} style={{ textTransform: "uppercase", fontSize: 12 }}>Sign out</button>
          </div>
        </div>
      </div>
      <div className="app-shell" style={{ maxWidth: 760 }}>
        <ChwDashboard mothers={chwMothers} />
        {stats && stats.total > 0 && (
          <div className="card" style={{ marginBottom: 20, background: "var(--lav-pale)", border: "none" }}>
            <p className="s-label">Impact so far</p>
            <div style={{ display: "flex", gap: 20, flexWrap: "wrap", marginTop: 8 }}>
              <div><p style={{ fontFamily: "var(--serif)", fontSize: 28 }}>{stats.total}</p><p className="muted" style={{ fontSize: 12 }}>danger alerts raised</p></div>
              <div><p style={{ fontFamily: "var(--serif)", fontSize: 28, color: "var(--green, #2e7d5b)" }}>{stats.sought_care}</p><p className="muted" style={{ fontSize: 12 }}>reached care</p></div>
              <div><p style={{ fontFamily: "var(--serif)", fontSize: 28 }}>{stats.with_outcome ? Math.round((stats.sought_care / stats.with_outcome) * 100) : 0}%</p><p className="muted" style={{ fontSize: 12 }}>of closed loops reached care</p></div>
            </div>
          </div>
        )}
        <p className="s-label">Human-in-the-loop</p>
        <h1 className="s-title" style={{ marginBottom: 8 }}>All open alerts</h1>
        <p className="muted" style={{ marginBottom: 24 }}>Flagged vitals needing review. Reach out, then mark reviewed or resolved.</p>

        {open.length === 0 ? (
          <p className="muted" style={{ marginBottom: 28 }}>✓ No open alerts right now.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 32 }}>{open.map(card)}</div>
        )}

        {handled.length > 0 && (
          <>
            <p className="s-label">Recently handled</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 8, opacity: 0.8 }}>{handled.map(card)}</div>
          </>
        )}
      </div>
    </>
  );
}
