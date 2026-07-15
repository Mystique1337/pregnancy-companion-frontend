"use client";
import { useState } from "react";
import ChwDashboard from "./ChwDashboard";

type ChwMother = { id: string; full_name: string; phone: string | null; whatsapp_number: string | null; current_week: number; language: string | null; open_alerts: number; last_alert_at: string | null };

type Alert = {
  id: string; level: string; kind: string; message: string; status: string;
  created_at: string; full_name: string; email: string; phone: string | null; whatsapp_number: string | null;
  reviewed_by: string | null;
};

export default function ClinicAlerts({ clinicianName, alerts, chwMothers = [] }: { clinicianName: string; alerts: Alert[]; chwMothers?: ChwMother[] }) {
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
        <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
          {phone && <a className="btn-ghost" href={`https://wa.me/${phone.replace(/\D/g, "")}`} target="_blank">WhatsApp her</a>}
          {a.status === "open" ? (
            <>
              <button className="btn-ghost" onClick={() => setStatus(a.id, "reviewed")} disabled={busy === a.id}>Mark reviewed</button>
              <button className="btn-pink" onClick={() => setStatus(a.id, "resolved")} disabled={busy === a.id}>Resolve</button>
            </>
          ) : (
            <>
              <span className="muted" style={{ fontSize: 12, alignSelf: "center" }}>
                {a.status} {a.reviewed_by ? `· ${a.reviewed_by}` : ""}
              </span>
              <button className="btn-ghost" onClick={() => setStatus(a.id, "open")} disabled={busy === a.id}>Reopen</button>
            </>
          )}
        </div>
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
