"use client";

import { useState } from "react";

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

/* Mirrors TimeToCare / ReachReport in lib/queries — declared locally so this
   client component never pulls the server-only db module into the bundle. */
type TimeToCare = {
  referrals: number;
  arrivals: number;
  arrivalRatePct: number;
  medianHours: number;
  fastestHours: number;
};

type ReachReport = {
  total: number;
  rural: number;
  urban: number;
  locationKnown: number;
  ruralPct: number;
  newToAnc: number;
  firstPregnancy: number;
  byLanguage: { language: string; n: number }[];
  byState: { state: string; n: number }[];
  withTransportPlan: number;
  withPartnerChannel: number;
  consented: number;
};

function Stat({ value, label, accent }: { value: string | number; label: string; accent?: string }) {
  return (
    <div style={{ minWidth: 120 }}>
      <p style={{ fontFamily: "var(--serif)", fontSize: 28, color: accent }}>{value}</p>
      <p className="muted" style={{ fontSize: 12 }}>{label}</p>
    </div>
  );
}

const pct = (n: number, d: number) => (d ? Math.round((n / d) * 100) : 0);

function humanMinutes(mins: number): string {
  if (mins < 90) return `${mins} min`;
  return `${Math.round((mins / 60) * 10) / 10} h`;
}

/** Confirm-arrival desk: the referral half of the loop is issued from the alert
 *  list below, but the arrival is confirmed here, where the metric it moves is
 *  visible — a clinician sees the median shift the moment she records it. */
function ArrivalForm() {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function confirm() {
    const c = code.trim();
    if (!c) { setMsg({ ok: false, text: "Enter the referral code she was given." }); return; }
    setBusy(true); setMsg(null);
    const res = await fetch("/api/clinic/arrival", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: c }),
    });
    const d: { minutesToCare?: number; error?: string } = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setMsg({ ok: false, text: d.error === "unknown code" ? `No referral matches ${c.toUpperCase()}.` : "Could not confirm — try again." });
      return;
    }
    setCode("");
    setMsg({
      ok: true,
      text: d.minutesToCare != null
        ? `✓ Arrival confirmed — ${humanMinutes(d.minutesToCare)} from danger sign to facility.`
        : "✓ Arrival confirmed.",
    });
    // Reload so the median above reflects the arrival that was just recorded.
    setTimeout(() => window.location.reload(), 1600);
  }

  return (
    <div style={{ marginTop: 18, paddingTop: 16, borderTop: "1px dashed var(--border)" }}>
      <label htmlFor="arrival-code" className="s-label" style={{ display: "block", marginBottom: 8 }}>
        She arrived — confirm her code
      </label>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <input
          id="arrival-code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") void confirm(); }}
          placeholder="BMP-4KX9"
          autoComplete="off"
          spellCheck={false}
          style={{
            flex: 1, minWidth: 180, minHeight: 44, padding: "10px 14px", borderRadius: 10,
            border: "1px solid var(--border)", fontSize: 14, fontFamily: "var(--sans)",
            letterSpacing: "0.08em", textTransform: "uppercase",
          }}
        />
        <button className="btn-pink" style={{ minHeight: 44 }} onClick={() => void confirm()} disabled={busy}>
          {busy ? "Confirming…" : "Confirm arrival"}
        </button>
      </div>
      {msg && (
        <p style={{ marginTop: 10, fontSize: 13, color: msg.ok ? "var(--sage)" : "var(--pink)" }}>{msg.text}</p>
      )}
      <p className="muted" style={{ fontSize: 12, marginTop: 10 }}>
        Referral codes are issued from the alert list below — open an alert, issue a referral, and she
        carries the code to the facility. Confirming it here closes the loop and times it.
      </p>
    </div>
  );
}

export default function ClinicReport({
  data,
  timeToCare,
  reach,
}: {
  data: ImpactReport;
  timeToCare: TimeToCare;
  reach: ReachReport;
}) {
  const green = "var(--green, #2e7d5b)";
  // Location is optional at enrolment, so the rural share is only honest against
  // the mothers we actually know about — flag it when most of them are unknown.
  const locationThin = reach.total > 0 && reach.locationKnown < reach.total / 2;

  return (
    <div style={{ marginBottom: 24 }}>
      <p className="s-label">Impact report</p>
      <h1 className="s-title" style={{ marginBottom: 8 }}>Program impact</h1>
      <p className="muted" style={{ marginBottom: 16 }}>
        Reach, danger-sign alerts, and closed-loop outcomes across all mothers.
      </p>

      {/* The headline outcome: everything else is activity, this is the delay we removed. */}
      <div className="card" style={{ marginBottom: 12, background: "var(--pink-pale)", border: "none" }}>
        <p className="s-label">Time to care</p>
        {timeToCare.arrivals === 0 ? (
          <>
            <p style={{ fontFamily: "var(--serif)", fontSize: 34, lineHeight: 1.1, marginBottom: 6 }}>
              Not measured yet
            </p>
            <p className="muted" style={{ marginBottom: 4 }}>
              No confirmed arrivals yet — issue a referral on an alert to start measuring. Once a mother
              shows her code at a facility, this becomes the median hours from her danger sign to the
              door.
            </p>
            {timeToCare.referrals > 0 && (
              <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>
                {timeToCare.referrals} referral{timeToCare.referrals > 1 ? "s" : ""} issued and waiting on
                a confirmation.
              </p>
            )}
          </>
        ) : (
          <>
            <p style={{ fontFamily: "var(--serif)", fontSize: 56, lineHeight: 1, color: "var(--ink)" }}>
              {timeToCare.medianHours}<span style={{ fontSize: 26 }}> h</span>
            </p>
            <p className="muted" style={{ fontSize: 13, marginTop: 4, marginBottom: 16 }}>
              median hours from danger sign to confirmed facility arrival
            </p>
            <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
              <Stat value={timeToCare.referrals} label="referrals issued" />
              <Stat value={timeToCare.arrivals} label="arrivals confirmed" accent={green} />
              <Stat value={`${timeToCare.arrivalRatePct}%`} label="of referrals arrived" accent={green} />
              <Stat value={`${timeToCare.fastestHours} h`} label="fastest arrival" />
            </div>
          </>
        )}
        <ArrivalForm />
      </div>

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

      {/* Equity: a programme that only reaches urban, ANC-experienced mothers has
          reached the people who were already going to be fine. */}
      <div className="card" style={{ marginBottom: 12 }}>
        <p className="s-label">Who we reach</p>
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap", marginTop: 8 }}>
          <Stat value={reach.total} label="mothers reached" />
          <Stat value={`${reach.ruralPct}%`} label="rural" accent={green} />
          <Stat value={`${pct(reach.newToAnc, reach.total)}%`} label="new to ANC" accent={green} />
          <Stat value={`${pct(reach.firstPregnancy, reach.total)}%`} label="first pregnancy" />
        </div>
        <p className="muted" style={{ fontSize: 12, marginTop: 12 }}>
          {reach.locationKnown > 0 ? (
            <>
              Rural share is {reach.rural} of {reach.locationKnown} mothers whose location we know
              ({reach.urban} urban).
              {locationThin && " Location is still unknown for most mothers — treat this share as indicative."}
            </>
          ) : (
            <>Location isn&apos;t recorded for any mother yet, so the rural share can&apos;t be claimed.</>
          )}
        </p>

        <div
          style={{
            display: "flex",
            gap: 24,
            flexWrap: "wrap",
            marginTop: 18,
            paddingTop: 16,
            borderTop: "1px dashed var(--border)",
          }}
        >
          <Stat value={reach.withTransportPlan} label="have a transport plan" />
          <Stat value={reach.withPartnerChannel} label="partner on the channel" />
          <Stat value={reach.consented} label="gave informed consent" />
        </div>

        {(reach.byLanguage.length > 0 || reach.byState.length > 0) && (
          <div style={{ marginTop: 18, paddingTop: 16, borderTop: "1px dashed var(--border)" }}>
            {reach.byLanguage.length > 0 && (
              <div style={{ marginBottom: 14 }}>
                <p className="s-label" style={{ marginBottom: 8 }}>By language</p>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {reach.byLanguage.map((l) => (
                    <span key={l.language} className="chip">
                      {l.language} · {l.n}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {reach.byState.length > 0 && (
              <div>
                <p className="s-label" style={{ marginBottom: 8 }}>By state</p>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {reach.byState.map((s) => (
                    <span key={s.state} className="chip">
                      {s.state} · {s.n}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <a className="btn-pink" href="/api/clinic/export" download style={{ marginTop: 4 }}>
        ⬇️ Download CSV
      </a>
    </div>
  );
}
