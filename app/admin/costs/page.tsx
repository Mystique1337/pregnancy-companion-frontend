import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/adminSession";
import { adminStats } from "@/lib/queries";
import {
  COST_MODEL,
  DEFAULT_USAGE,
  DEFAULT_USD_TO_NGN,
  estimateMonthlyCost,
  paidChatEquivalentUsd,
  withMothers,
} from "@/lib/costs";
import AdminNav from "../../_components/AdminNav";

export const dynamic = "force-dynamic";

// The cost curve a funder wants to see: does this get cheaper per mother as it grows?
const SCENARIOS = [100, 1_000, 10_000, 100_000];

const usd = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const usdFine = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 })}`;
const ngn = (n: number) => `₦${Math.round(n).toLocaleString("en-NG")}`;

export default async function AdminCosts() {
  if (!(await isAdmin())) redirect("/admin/login");

  const s = await adminStats();
  const usdToNgn = DEFAULT_USD_TO_NGN;

  // Today's real position — the live cohort, not a projection.
  const liveUsage = withMothers(DEFAULT_USAGE, s.users);
  const live = estimateMonthlyCost(liveUsage, usdToNgn);
  const scenarios = SCENARIOS.map((m) => ({ mothers: m, est: estimateMonthlyCost(withMothers(DEFAULT_USAGE, m), usdToNgn) }));

  const th = { padding: "8px 4px", fontWeight: 500 } as const;
  const td = { padding: "8px 4px" } as const;
  const headRow = { textAlign: "left", color: "var(--ink-muted)", borderBottom: "1px solid var(--border)" } as const;

  const stat = (label: string, value: string, sub: string, tint: string) => (
    <div className="card" style={{ background: tint, border: "none" }}>
      <p className="s-label">{label}</p>
      <p style={{ fontFamily: "var(--serif)", fontSize: 38, lineHeight: 1.1 }}>{value}</p>
      <p className="muted" style={{ fontSize: 12, marginTop: 6 }}>{sub}</p>
    </div>
  );

  return (
    <>
      <AdminNav active="costs" />
      <div className="app-shell">
        <p className="s-label">Unit economics</p>
        <h1 className="s-title" style={{ marginBottom: 8 }}>What it costs to serve a mother</h1>
        <p className="muted" style={{ marginBottom: 24 }}>
          Every figure below is derived from one file — <code>lib/costs.ts</code> — where each price carries a note
          saying where it came from. Change a price there and this page moves with it. Nothing here is rounded
          in our favour.
        </p>

        {s.users === 0 ? (
          <div className="card" style={{ marginBottom: 16, background: "var(--gold-lt)", border: "none" }}>
            <p className="s-label">No mothers enrolled yet</p>
            <p className="muted">
              Cost per mother is undefined at zero. The flat infrastructure bill is {usd(live.fixedUsd)}/month
              regardless; the scenarios below show where the number lands as the cohort grows.
            </p>
          </div>
        ) : (
          <div className="grid-2" style={{ marginBottom: 16 }}>
            {stat(
              "Cost per mother · per month",
              ngn(live.perMotherNgn),
              `${usdFine(live.perMotherUsd)} at ₦${usdToNgn.toLocaleString("en-NG")}/$1 · ${s.users.toLocaleString()} mothers enrolled today`,
              "var(--pink-pale)",
            )}
            {stat(
              "Total run cost · per month",
              usd(live.totalUsd),
              `${usd(live.fixedUsd)} fixed + ${usd(live.variableUsd)} usage-driven`,
              "var(--lav-pale)",
            )}
          </div>
        )}

        <div className="grid-2" style={{ marginBottom: 28 }}>
          {stat(
            "Fixed",
            usd(live.fixedUsd),
            "Hosting, database, WhatsApp gateway. Does not move with cohort size — this is what amortises.",
            "var(--blue-pale)",
          )}
          {stat(
            "Usage-driven",
            usd(live.variableUsd),
            "Modal GPU/CPU seconds for voice, transcription and translation. Scales with real use, and only with real use.",
            "var(--cream)",
          )}
        </div>

        {/* ---- The curve: the number that actually answers "does this scale?" ---- */}
        <div className="card" style={{ marginBottom: 16 }}>
          <p className="s-label">Cost curve</p>
          <h3 className="feat-title" style={{ marginBottom: 6 }}>Cost per mother falls as fixed costs spread</h3>
          <p className="muted" style={{ marginBottom: 12 }}>
            Same behaviour per mother in every row ({DEFAULT_USAGE.textRepliesPerMotherPerMonth} text replies,{" "}
            {DEFAULT_USAGE.voiceRepliesPerMotherPerMonth} voice replies,{" "}
            {DEFAULT_USAGE.transcriptionsPerMotherPerMonth} voice notes,{" "}
            {DEFAULT_USAGE.translationsPerMotherPerMonth} translations per month). Only the cohort size changes.
          </p>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse", minWidth: 520 }}>
              <thead>
                <tr style={headRow}>
                  <th style={th}>Mothers</th>
                  <th style={th}>Total / month</th>
                  <th style={th}>Fixed</th>
                  <th style={th}>Usage-driven</th>
                  <th style={th}>Per mother</th>
                  <th style={th}>Per mother (₦)</th>
                </tr>
              </thead>
              <tbody>
                {scenarios.map((row) => (
                  <tr key={row.mothers} style={{ borderTop: "1px solid var(--border)" }}>
                    <td style={{ ...td, fontWeight: 500 }}>{row.mothers.toLocaleString()}</td>
                    <td style={td}>{usd(row.est.totalUsd)}</td>
                    <td style={td} className="muted">{usd(row.est.fixedUsd)}</td>
                    <td style={td} className="muted">{usd(row.est.variableUsd)}</td>
                    <td style={td}>{usdFine(row.est.perMotherUsd)}</td>
                    <td style={{ ...td, fontFamily: "var(--serif)", fontSize: 17, color: "var(--pink)" }}>
                      {ngn(row.est.perMotherNgn)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="muted" style={{ fontSize: 11, marginTop: 12 }}>
            Two things drive the fall: the {usd(live.fixedUsd)}/month flat bill spreads over more mothers, and Modal&apos;s
            {" "}{COST_MODEL.idleTailSeconds.seconds}s scale-down tail stops being paid per-request once traffic is dense
            enough to keep a container warm. Beyond ~10,000 mothers the flat line would itself need to grow (a larger
            VPS, a second Railway service), so treat the 100,000 row as a floor rather than a forecast.
          </p>
        </div>

        {/* ---- Line by line ---- */}
        <div className="card" style={{ marginBottom: 16 }}>
          <p className="s-label">Breakdown</p>
          <h3 className="feat-title" style={{ marginBottom: 6 }}>
            {s.users.toLocaleString()} mothers · {usd(live.totalUsd)} per month
          </h3>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse", minWidth: 520 }}>
              <thead>
                <tr style={headRow}>
                  <th style={th}>Line</th>
                  <th style={{ ...th, whiteSpace: "nowrap" }}>USD / month</th>
                  <th style={th}>Basis</th>
                </tr>
              </thead>
              <tbody>
                {live.breakdown.map((b) => (
                  <tr key={b.label} style={{ borderTop: "1px solid var(--border)" }}>
                    <td style={{ ...td, fontWeight: 500 }}>{b.label}</td>
                    <td style={{ ...td, whiteSpace: "nowrap", color: b.usd === 0 ? "var(--lavender)" : "inherit" }}>
                      {b.usd === 0 ? "$0.00" : usd(b.usd)}
                    </td>
                    <td style={{ ...td, color: "var(--ink-muted)", fontSize: 12 }}>{b.note}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ borderTop: "2px solid var(--border)" }}>
                  <td style={{ ...td, fontWeight: 600 }}>Total</td>
                  <td style={{ ...td, fontWeight: 600 }}>{usd(live.totalUsd)}</td>
                  <td style={{ ...td, color: "var(--ink-muted)", fontSize: 12 }}>
                    {s.users > 0 ? `${usdFine(live.perMotherUsd)} (${ngn(live.perMotherNgn)}) per mother per month` : "—"}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* ---- The part a funder will interrogate ---- */}
        <div className="card">
          <p className="s-label">How this is calculated</p>
          <h3 className="feat-title" style={{ marginBottom: 12 }}>Assumptions, stated plainly</h3>
          <ul className="muted" style={{ fontSize: 13, lineHeight: 1.9, paddingLeft: 18, margin: 0 }}>
            <li>
              <strong>This is technology cost only.</strong> It excludes CHW and clinical staff time, mothers&apos;
              handsets and data, facility-side costs, and one-off development. A full programme cost per beneficiary
              is a larger number — this page answers &ldquo;what does the platform cost to run&rdquo;, not
              &ldquo;what does the programme cost&rdquo;.
            </li>
            <li>
              <strong>Usage profile per mother per month:</strong> {DEFAULT_USAGE.textRepliesPerMotherPerMonth} text
              replies, {DEFAULT_USAGE.voiceRepliesPerMotherPerMonth} voice replies,{" "}
              {DEFAULT_USAGE.transcriptionsPerMotherPerMonth} voice notes transcribed,{" "}
              {DEFAULT_USAGE.translationsPerMotherPerMonth} translations. Roughly weekly contact — deliberately not a
              power user, since overstating usage would flatter the per-interaction cost.
            </li>
            <li>
              <strong>GPU time is billed per second, including the shutdown tail.</strong> Modal keeps a container
              alive for {COST_MODEL.idleTailSeconds.seconds}s after the last request and bills for it
              (<code>scaledown_window=120</code> in <code>modal/*.py</code>). We include that tail. At pilot volume
              requests are minutes apart so each one carries almost a full tail; at scale, requests inside the same
              window share one. We model the sharing with a Poisson arrival assumption rather than pretending the tail
              is free or charging it twice.
            </li>
            <li>
              <strong>Job durations:</strong> {COST_MODEL.duration.voiceReplySeconds.seconds}s per voice reply on an
              A10G at ${COST_MODEL.gpu.tts.usdPerHour.toFixed(2)}/hr,{" "}
              {COST_MODEL.duration.transcriptionSeconds.seconds}s per transcription on a T4 at
              ${COST_MODEL.gpu.asr.usdPerHour.toFixed(2)}/hr, and{" "}
              {COST_MODEL.duration.translationSeconds.seconds}s per translation on CPU at
              ${COST_MODEL.gpu.translator.usdPerHour.toFixed(2)}/hr.
            </li>
            <li>
              <strong>Chat and vision inference is genuinely ₦0 today</strong> — NVIDIA&apos;s hosted NIM developer
              tier. That is not a business model, so we also price the paid equivalent: at{" "}
              {s.users.toLocaleString()} mothers it would add{" "}
              <strong>{usd(paidChatEquivalentUsd(liveUsage))}/month</strong>, and at 10,000 mothers{" "}
              <strong>{usd(paidChatEquivalentUsd(withMothers(DEFAULT_USAGE, 10_000)))}/month</strong>{" "}
              (~{COST_MODEL.chat.tokensPerTextReply.tokens.toLocaleString()} tokens per reply at
              ${COST_MODEL.chat.paidEquivalent.usdPerMillionTokens.toFixed(2)} per million). That per-million figure is
              an order-of-magnitude placeholder for commodity hosted inference, not a quoted contract price.
            </li>
            <li>
              <strong>Offline use costs us nothing.</strong> Offline knowledge-base answers and on-device speech run on
              the handset. They improve the average cost per interaction and keep working with no network — the reason
              the model does not collapse in low-connectivity areas.
            </li>
            <li>
              <strong>Fixed infrastructure is held constant</strong> across every scenario: Railway{" "}
              ${COST_MODEL.fixed.railway.usdPerMonth}, self-hosted Supabase VPS ${COST_MODEL.fixed.supabaseVps.usdPerMonth},
              Evolution WhatsApp gateway ${COST_MODEL.fixed.evolutionWhatsapp.usdPerMonth}, Plunk email $0 (negligible
              at this volume, booked openly rather than hidden). Realistic through ~10,000 mothers; understated beyond it.
            </li>
            <li>
              <strong>FX:</strong> converted at ₦{usdToNgn.toLocaleString("en-NG")} to $1. Rates move — it is a
              parameter in <code>estimateMonthlyCost()</code>, not a constant baked into the arithmetic.
            </li>
            <li>
              <strong>Not modelled:</strong> data egress, object storage, SMS/USSD fallback (carrier-priced and
              country-specific), and per-message WhatsApp fees — the Evolution gateway path carries none, but a move to
              the WhatsApp Business API would add a per-conversation fee that changes this page materially.
            </li>
          </ul>
        </div>
      </div>
    </>
  );
}
