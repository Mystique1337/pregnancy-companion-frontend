"use client";

type ImpactReport = {
  totalMothers: number;
  whatsappEnrolled: number;
  withWhatsappNumber: number;
  delivered: number;
  alertsUrgent: number;
  alertsWarning: number;
  alertsTotal: number;
  withOutcome: number;
  soughtCare: number;
  referred: number;
  ok: number;
  noResponse: number;
  reachedCarePct: number;
  avgHoursToOutcome: number;
};

function Stat({ value, label, accent }: { value: string | number; label: string; accent?: string }) {
  return (
    <div style={{ minWidth: 120 }}>
      <p style={{ fontFamily: "var(--serif)", fontSize: 28, color: accent }}>{value}</p>
      <p className="muted" style={{ fontSize: 12 }}>{label}</p>
    </div>
  );
}

export default function ClinicReport({ data }: { data: ImpactReport }) {
  const green = "var(--green, #2e7d5b)";
  return (
    <div style={{ marginBottom: 24 }}>
      <p className="s-label">Impact report</p>
      <h1 className="s-title" style={{ marginBottom: 8 }}>Program impact</h1>
      <p className="muted" style={{ marginBottom: 16 }}>
        Reach, danger-sign alerts, and closed-loop outcomes across all mothers.
      </p>

      <div className="card" style={{ marginBottom: 12 }}>
        <p className="s-label">Reach</p>
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap", marginTop: 8 }}>
          <Stat value={data.totalMothers} label="mothers enrolled" />
          <Stat value={data.whatsappEnrolled} label="via WhatsApp / CHW" />
          <Stat value={data.withWhatsappNumber} label="with a WhatsApp number" />
          <Stat value={data.delivered} label="delivered (postpartum)" />
        </div>
      </div>

      <div className="card" style={{ marginBottom: 12 }}>
        <p className="s-label">Danger-sign alerts</p>
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap", marginTop: 8 }}>
          <Stat value={data.alertsTotal} label="alerts raised" />
          <Stat value={data.alertsUrgent} label="urgent" accent="var(--pink)" />
          <Stat value={data.alertsWarning} label="warning" accent="var(--gold)" />
          <Stat value={data.withOutcome} label="loops closed" />
        </div>
      </div>

      <div className="card" style={{ marginBottom: 12, background: "var(--lav-pale)", border: "none" }}>
        <p className="s-label">Outcomes</p>
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap", marginTop: 8 }}>
          <Stat value={`${data.reachedCarePct}%`} label="of closed loops reached care" accent={green} />
          <Stat value={data.soughtCare} label="✅ reached care" accent={green} />
          <Stat value={data.referred} label="🏥 referred" />
          <Stat value={data.ok} label="🙂 she's okay" />
          <Stat value={data.noResponse} label="📵 no response" />
          <Stat value={data.avgHoursToOutcome} label="avg hours to outcome" />
        </div>
      </div>

      <a className="btn-pink" href="/api/clinic/export" download style={{ marginTop: 4 }}>
        ⬇️ Download CSV
      </a>
    </div>
  );
}
