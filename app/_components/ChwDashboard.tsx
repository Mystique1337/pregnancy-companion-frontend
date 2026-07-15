"use client";
import { useState } from "react";

type ChwMother = { id: string; full_name: string; phone: string | null; whatsapp_number: string | null; current_week: number; language: string | null; open_alerts: number; last_alert_at: string | null };

export default function ChwDashboard({ mothers }: { mothers: ChwMother[] }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [week, setWeek] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function enroll() {
    if (!name.trim() || phone.replace(/\D/g, "").length < 10) { setMsg("Enter her name and a valid phone number."); return; }
    setBusy(true); setMsg("");
    const res = await fetch("/api/clinic/enroll", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ full_name: name, phone, current_week: week ? Number(week) : undefined }),
    });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setMsg(d.error || "Could not enrol her."); return; }
    setName(""); setPhone(""); setWeek("");
    setMsg(d.linked ? "✓ Linked her existing account to you." : "✓ Enrolled. Reload to see her.");
    setTimeout(() => window.location.reload(), 900);
  }

  return (
    <div style={{ marginBottom: 28 }}>
      <div className="card" style={{ marginBottom: 18 }}>
        <p className="s-label">Enrol a mother</p>
        <p className="muted" style={{ marginBottom: 14, fontSize: 13 }}>Add a mother in your area by her phone number. She uses Bumply on WhatsApp — you get alerted when she hits a danger sign.</p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div style={{ flex: 2, minWidth: 160 }}>
            <label className="s-label" style={{ display: "block", marginBottom: 6 }}>Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Amara" style={inp} />
          </div>
          <div style={{ flex: 2, minWidth: 160 }}>
            <label className="s-label" style={{ display: "block", marginBottom: 6 }}>Phone (WhatsApp)</label>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0803 000 0000" inputMode="tel" style={inp} />
          </div>
          <div>
            <label className="s-label" style={{ display: "block", marginBottom: 6 }}>Week</label>
            <input value={week} onChange={(e) => setWeek(e.target.value)} placeholder="24" inputMode="numeric" style={{ ...inp, maxWidth: 80 }} />
          </div>
          <button className="f-submit" style={{ maxWidth: 130 }} onClick={enroll} disabled={busy}>{busy ? "Enrolling…" : "Enrol"}</button>
        </div>
        {msg && <p style={{ marginTop: 10, fontSize: 13, color: msg.startsWith("✓") ? "var(--sage)" : "var(--pink)" }}>{msg}</p>}
      </div>

      <p className="s-label">My mothers ({mothers.length})</p>
      {mothers.length === 0 ? (
        <p className="muted" style={{ marginTop: 8 }}>No mothers yet — enrol your first above.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
          {mothers.map((m) => {
            const num = m.whatsapp_number || m.phone || "";
            const wa = num.replace(/\D/g, "").replace(/^0/, "234");
            return (
              <div key={m.id} className="card" style={{ padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, borderLeft: m.open_alerts > 0 ? "4px solid var(--pink)" : "4px solid var(--border)" }}>
                <div>
                  <p style={{ fontWeight: 600 }}>{m.full_name} {m.open_alerts > 0 && <span style={{ background: "var(--pink)", color: "#fff", borderRadius: 100, fontSize: 11, padding: "2px 8px", marginLeft: 6 }}>🚨 {m.open_alerts} alert{m.open_alerts > 1 ? "s" : ""}</span>}</p>
                  <p className="muted" style={{ fontSize: 12 }}>Week {m.current_week}{num ? ` · ${num}` : ""}{m.language && m.language !== "en" ? ` · ${m.language}` : ""}</p>
                </div>
                {wa && <a className="chip" href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer" style={{ background: "var(--sage)", color: "#fff", borderColor: "var(--sage)" }}>WhatsApp</a>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const inp: React.CSSProperties = { width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid var(--border)", fontSize: 14, fontFamily: "var(--sans)" };
