import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getMotherById, listVitals, listAlertsForMother, type Vital } from "@/lib/queries";
import { getSettings } from "@/lib/settings";
import { VITAL_KINDS } from "@/lib/vitals";
import AppHeader from "../_components/AppHeader";
import VitalsForm from "../_components/VitalsForm";

export const dynamic = "force-dynamic";

// Tiny inline sparkline (no chart lib).
function Spark({ values }: { values: number[] }) {
  if (values.length < 2) return null;
  const w = 220, h = 40, pad = 4;
  const min = Math.min(...values), max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => {
    const x = pad + (i / (values.length - 1)) * (w - pad * 2);
    const y = h - pad - ((v - min) / span) * (h - pad * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  return (
    <svg width={w} height={h} style={{ display: "block", marginTop: 8 }}>
      <polyline points={pts.join(" ")} fill="none" stroke="var(--pink)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function fmtVal(v: Vital): string {
  if (v.kind === "bp") return `${v.value ?? "—"}/${v.value2 ?? "—"}`;
  return `${v.value ?? "—"}`;
}

export default async function VitalsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const mother = await getMotherById(session.sub);
  if (!mother) redirect("/login");

  const settings = await getSettings();
  const features = { journal: settings.journal_enabled, tools: settings.tools_enabled, chat: settings.chat_enabled };
  const all = await listVitals(mother.id, undefined, 200);
  const alerts = await listAlertsForMother(mother.id, 5);

  return (
    <>
      <AppHeader plan={mother.plan} lang={mother.language} active="vitals" features={features} />
      <div className="app-shell" style={{ maxWidth: 720 }}>
        <p className="s-label">Health</p>
        <h1 className="s-title" style={{ marginBottom: 6 }}>Your vitals</h1>
        <p className="muted" style={{ marginBottom: 24 }}>
          Track your blood pressure, weight, temperature and more. Bumply watches for anything that needs a
          provider&apos;s attention — but always trust your own body and your clinic.
        </p>

        <div style={{ display: "flex", gap: 18, flexWrap: "wrap", marginBottom: 18 }}>
          <a className="btn-ghost" href="/triage" style={{ display: "inline-flex" }}>🩺 Check a symptom</a>
          <a className="btn-ghost" href="/report" style={{ display: "inline-flex" }}>📄 Generate a report for your doctor</a>
        </div>

        <VitalsForm />

        {alerts.length > 0 && (
          <div style={{ marginBottom: 28 }}>
            <p className="s-label">Recent alerts</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
              {alerts.map((a) => (
                <div key={a.id} className="card" style={{ borderLeft: `4px solid ${a.level === "urgent" ? "var(--pink)" : "var(--gold)"}` }}>
                  <p style={{ fontSize: 14 }}>{a.level === "urgent" ? "🚨 " : "⚠️ "}{a.message}</p>
                  <p className="muted" style={{ fontSize: 11, marginTop: 4 }}>{new Date(a.created_at).toLocaleString()}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        <p className="s-label">History</p>
        <h3 className="feat-title" style={{ marginBottom: 16 }}>Your readings</h3>
        {all.length === 0 ? (
          <p className="muted">No readings yet — log your first above.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {VITAL_KINDS.map((meta) => {
              const rows = all.filter((v) => v.kind === meta.kind);
              if (rows.length === 0) return null;
              const latest = rows[0];
              const chrono = [...rows].reverse();
              const series = chrono.map((v) => Number(v.value || 0)).filter((n) => !Number.isNaN(n));
              return (
                <div key={meta.kind} className="card">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                    <p style={{ fontFamily: "var(--serif)", fontSize: 18 }}>{meta.emoji} {meta.label}</p>
                    <p style={{ fontFamily: "var(--serif)", fontSize: 26, color: "var(--pink)" }}>
                      {fmtVal(latest)} <span className="muted" style={{ fontSize: 13 }}>{meta.unit}</span>
                    </p>
                  </div>
                  <Spark values={series} />
                  <p className="muted" style={{ fontSize: 11, marginTop: 8 }}>
                    {rows.length} reading{rows.length > 1 ? "s" : ""} · latest {new Date(latest.created_at).toLocaleDateString()}
                    {meta.normal ? ` · normal: ${meta.normal}` : ""}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
