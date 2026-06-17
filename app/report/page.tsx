import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getMotherById, listVitals, listAlertsForMother, recentJournalSummary, type Vital } from "@/lib/queries";
import { currentWeekFrom, trimesterFor } from "@/lib/babyData";
import { VITAL_KINDS, evaluateVital, type VitalKind } from "@/lib/vitals";
import { clinicalSummary } from "@/lib/report";
import ReportPrint from "../_components/ReportPrint";

export const dynamic = "force-dynamic";

function fmtVal(v: Vital): string {
  return v.kind === "bp" ? `${v.value ?? "—"}/${v.value2 ?? "—"}` : `${v.value ?? "—"}`;
}

export default async function ReportPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const mother = await getMotherById(session.sub);
  if (!mother) redirect("/login");

  const week = currentWeekFrom({ dueDate: mother.due_date, enteredWeek: mother.current_week, createdAt: mother.created_at });
  const vitals = await listVitals(mother.id, undefined, 100);
  const alerts = await listAlertsForMother(mother.id, 12);
  const journal = await recentJournalSummary(mother.id, 7);
  let summary = "";
  try {
    summary = await clinicalSummary(mother, week, vitals, alerts, journal);
  } catch { /* show structured data without the AI paragraph */ }

  const edd = mother.due_date ? new Date(mother.due_date).toISOString().slice(0, 10) : "—";
  const today = new Date().toISOString().slice(0, 10);
  const row = (k: string, v: string) => (
    <tr><td style={{ padding: "5px 10px 5px 0", color: "#6b5a4d", whiteSpace: "nowrap" }}>{k}</td><td style={{ padding: "5px 0" }}>{v || "—"}</td></tr>
  );

  return (
    <div style={{ background: "#fff", color: "#2E2620", minHeight: "100vh", fontFamily: "'DM Sans', system-ui, sans-serif", padding: "28px 16px" }}>
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <ReportPrint />

        <div style={{ border: "1px solid #e6ddd4", borderRadius: 14, padding: "28px 30px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", borderBottom: "2px solid #C97B5A", paddingBottom: 10, marginBottom: 18 }}>
            <h1 style={{ fontFamily: "Georgia, serif", fontWeight: 400, fontSize: 26 }}>Pregnancy summary</h1>
            <span style={{ fontSize: 12, color: "#9A8576" }}>Generated {today} · Bumply</span>
          </div>

          {summary && (
            <div style={{ marginBottom: 20 }}>
              <h2 style={{ fontSize: 13, letterSpacing: ".08em", textTransform: "uppercase", color: "#C97B5A", marginBottom: 6 }}>Summary for your provider</h2>
              <p style={{ fontSize: 14, lineHeight: 1.7 }}>{summary}</p>
            </div>
          )}

          <h2 style={{ fontSize: 13, letterSpacing: ".08em", textTransform: "uppercase", color: "#C97B5A", marginBottom: 6 }}>Patient</h2>
          <table style={{ fontSize: 14, marginBottom: 20 }}>
            <tbody>
              {row("Name", mother.full_name)}
              {row("Gestational week", `${week} · ${trimesterFor(week)} trimester`)}
              {row("Estimated due date", edd)}
              {row("First pregnancy", mother.first_pregnancy ? "Yes" : "No")}
              {row("Ethnicity", mother.ethnicity || "—")}
              {row("Dietary", mother.dietary_restrictions || "None")}
            </tbody>
          </table>

          <h2 style={{ fontSize: 13, letterSpacing: ".08em", textTransform: "uppercase", color: "#C97B5A", marginBottom: 6 }}>Latest vitals</h2>
          <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse", marginBottom: 20 }}>
            <thead>
              <tr style={{ textAlign: "left", color: "#9A8576", borderBottom: "1px solid #e6ddd4" }}>
                <th style={{ padding: "6px 4px" }}>Measure</th><th style={{ padding: "6px 4px" }}>Latest</th><th style={{ padding: "6px 4px" }}>Date</th><th style={{ padding: "6px 4px" }}>Normal</th>
              </tr>
            </thead>
            <tbody>
              {VITAL_KINDS.map((meta) => {
                const latest = vitals.find((v) => v.kind === meta.kind);
                if (!latest) return null;
                const flag = evaluateVital(meta.kind as VitalKind, latest.value != null ? Number(latest.value) : null, latest.value2 != null ? Number(latest.value2) : null);
                return (
                  <tr key={meta.kind} style={{ borderBottom: "1px solid #f0e9e1" }}>
                    <td style={{ padding: "6px 4px" }}>{meta.label}</td>
                    <td style={{ padding: "6px 4px", fontWeight: 600, color: flag ? "#C0392B" : "#2E2620" }}>{fmtVal(latest)} {meta.unit}{flag ? " ⚠" : ""}</td>
                    <td style={{ padding: "6px 4px", color: "#9A8576" }}>{new Date(latest.created_at).toISOString().slice(0, 10)}</td>
                    <td style={{ padding: "6px 4px", color: "#9A8576" }}>{meta.normal || "—"}</td>
                  </tr>
                );
              })}
              {vitals.length === 0 && (<tr><td colSpan={4} style={{ padding: "8px 4px", color: "#9A8576" }}>No vitals logged.</td></tr>)}
            </tbody>
          </table>

          {alerts.length > 0 && (
            <>
              <h2 style={{ fontSize: 13, letterSpacing: ".08em", textTransform: "uppercase", color: "#C97B5A", marginBottom: 6 }}>Alerts raised</h2>
              <ul style={{ fontSize: 13, lineHeight: 1.6, paddingLeft: 18, marginBottom: 20 }}>
                {alerts.map((a) => (
                  <li key={a.id}>{a.level === "urgent" ? "🚨" : "⚠"} {a.message} <span style={{ color: "#9A8576" }}>({new Date(a.created_at).toISOString().slice(0, 10)}, {a.status})</span></li>
                ))}
              </ul>
            </>
          )}

          {journal && (
            <>
              <h2 style={{ fontSize: 13, letterSpacing: ".08em", textTransform: "uppercase", color: "#C97B5A", marginBottom: 6 }}>Recent symptoms & mood (self-reported)</h2>
              <pre style={{ fontSize: 13, lineHeight: 1.6, whiteSpace: "pre-wrap", fontFamily: "inherit", marginBottom: 20 }}>{journal}</pre>
            </>
          )}

          <p style={{ fontSize: 11, color: "#9A8576", borderTop: "1px solid #e6ddd4", paddingTop: 12 }}>
            This summary is generated from self-reported data in the Bumply pregnancy-companion app. It is not a medical record and may contain errors — please verify clinically.
          </p>
        </div>
      </div>
    </div>
  );
}
