import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/adminSession";
import { populationStats, adminStats } from "@/lib/queries";
import AdminNav from "../../_components/AdminNav";

export const dynamic = "force-dynamic";

const KIND_LABEL: Record<string, string> = {
  bp: "Blood pressure", fever: "Fever", temp: "Temperature", fhr: "Baby heartbeat",
  glucose: "Blood sugar", weight: "Weight", symptom: "Symptom check", emergency: "Emergency",
  mood: "Wellbeing", "risk:preeclampsia": "Risk · pre-eclampsia", "risk:gdm": "Risk · diabetes",
  "risk:preterm": "Risk · preterm",
};
const kindLabel = (k: string) => KIND_LABEL[k] || k;

export default async function AdminInsights() {
  if (!(await isAdmin())) redirect("/admin/login");
  const [s, p] = await Promise.all([adminStats(), populationStats()]);
  const maxTri = Math.max(1, ...p.byTrimester.map((t) => t.count));
  const maxLang = Math.max(1, ...p.byLanguage.map((l) => l.count));

  const bar = (label: string, count: number, max: number, color: string) => (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
        <span style={{ textTransform: "capitalize" }}>{label}</span><span className="muted">{count}</span>
      </div>
      <div style={{ height: 10, borderRadius: 6, background: "var(--cream)", overflow: "hidden" }}>
        <div style={{ width: `${(count / max) * 100}%`, height: "100%", background: color }} />
      </div>
    </div>
  );
  const stat = (label: string, value: number, tint: string) => (
    <div className="card" style={{ background: tint, border: "none" }}>
      <p className="s-label">{label}</p>
      <p style={{ fontFamily: "var(--serif)", fontSize: 34, lineHeight: 1.1 }}>{value}</p>
    </div>
  );

  return (
    <>
      <AdminNav active="insights" />
      <div className="app-shell">
        <p className="s-label">Population health</p>
        <h1 className="s-title" style={{ marginBottom: 8 }}>Insights</h1>
        <p className="muted" style={{ marginBottom: 24 }}>
          Anonymised, aggregate view of the cohort — the kind of signal a clinic, HMO or health authority would monitor.
          No personal data, counts only.
        </p>

        <div className="grid-2" style={{ marginBottom: 16 }}>
          {stat("Mothers tracked", s.users, "var(--pink-pale)")}
          {stat("Open alerts", p.openAlerts, "var(--gold-lt)")}
        </div>
        <div className="grid-2" style={{ marginBottom: 28 }}>
          {stat("Emergencies", p.emergencies, "var(--pink-pale)")}
          {stat("Wellbeing flags", p.moodFlags, "var(--lav-pale)")}
        </div>

        <div className="grid-2" style={{ alignItems: "start" }}>
          <div className="card" style={{ marginBottom: 16 }}>
            <p className="s-label">By trimester</p>
            <div style={{ marginTop: 12 }}>
              {p.byTrimester.map((t) => bar(t.label, t.count, maxTri, "var(--pink)"))}
            </div>
          </div>
          <div className="card" style={{ marginBottom: 16 }}>
            <p className="s-label">By language</p>
            <div style={{ marginTop: 12 }}>
              {p.byLanguage.map((l) => bar(l.label, l.count, maxLang, "var(--lavender)"))}
            </div>
          </div>
        </div>

        <div className="card">
          <p className="s-label">Alerts &amp; risk signals</p>
          {p.alertsByKind.length === 0 ? (
            <p className="muted" style={{ marginTop: 12 }}>No alerts raised yet.</p>
          ) : (
            <table style={{ width: "100%", marginTop: 12, fontSize: 13, borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ textAlign: "left", color: "var(--ink-muted)", borderBottom: "1px solid var(--border)" }}>
                  <th style={{ padding: "6px 4px", fontWeight: 500 }}>Signal</th>
                  <th style={{ padding: "6px 4px", fontWeight: 500 }}>Total</th>
                  <th style={{ padding: "6px 4px", fontWeight: 500 }}>Open</th>
                  <th style={{ padding: "6px 4px", fontWeight: 500 }}>Urgent</th>
                </tr>
              </thead>
              <tbody>
                {p.alertsByKind.map((a) => (
                  <tr key={a.kind} style={{ borderTop: "1px solid var(--border)" }}>
                    <td style={{ padding: "6px 4px" }}>{kindLabel(a.kind)}</td>
                    <td style={{ padding: "6px 4px" }}>{a.total}</td>
                    <td style={{ padding: "6px 4px", color: a.open ? "var(--pink)" : "inherit" }}>{a.open}</td>
                    <td style={{ padding: "6px 4px", fontWeight: a.urgent ? 700 : 400, color: a.urgent ? "var(--pink)" : "inherit" }}>{a.urgent}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p className="muted" style={{ fontSize: 11, marginTop: 12 }}>ANC reminders delivered: {p.ancReminders} · Total alerts: {p.totalAlerts}</p>
        </div>
      </div>
    </>
  );
}
