import { type RiskReport, RISK_COLORS } from "@/lib/risk";

// Presentational risk-insight card (server-safe). Shows each screened condition,
// its level, the explainable drivers, and clear advice.
export default function RiskCard({ report, compact = false }: { report: RiskReport; compact?: boolean }) {
  const overall = RISK_COLORS[report.overall];
  return (
    <div className="card" style={{ borderLeft: `4px solid ${overall.border}` }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <div>
          <p className="s-label" style={{ marginBottom: 4 }}>Health insight</p>
          <h3 className="feat-title" style={{ margin: 0, fontSize: 20 }}>What Bumply is watching</h3>
        </div>
        <span style={{ fontSize: 12, fontWeight: 600, color: overall.text, background: overall.bg, border: `1px solid ${overall.border}`, borderRadius: 100, padding: "5px 12px" }}>
          Overall: {overall.label}
        </span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 16 }}>
        {report.assessments.map((a) => {
          const c = RISK_COLORS[a.level];
          return (
            <div key={a.condition} style={{ border: "1px solid var(--border)", borderRadius: 12, padding: "12px 14px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 14, fontWeight: 600 }}>{a.emoji} {a.label}</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: c.text, background: c.bg, borderRadius: 100, padding: "3px 10px" }}>{c.label}</span>
              </div>
              {!compact && a.factors.length > 0 && (
                <ul style={{ margin: "8px 0 0", paddingLeft: 18, fontSize: 13, color: "var(--ink-mid)", lineHeight: 1.6 }}>
                  {a.factors.map((f, i) => <li key={i}>{f}</li>)}
                </ul>
              )}
              {!compact && <p className="muted" style={{ fontSize: 12.5, marginTop: 8 }}>{a.advice}</p>}
            </div>
          );
        })}
      </div>
      <p className="muted" style={{ fontSize: 11, marginTop: 14 }}>
        This is a screening aid from your own logged data — not a diagnosis. Your provider&apos;s assessment always comes first.
      </p>
    </div>
  );
}
