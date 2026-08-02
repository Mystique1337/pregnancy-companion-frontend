"use client";

import { useMemo } from "react";

/* Mirrors WorklistRow in lib/queries. Kept local so this client component never
   drags the server-only postgres module into the browser bundle — same pattern
   as ClinicAlerts / ChwDashboard. */
type WorklistRow = {
  id: string;
  full_name: string;
  phone: string | null;
  whatsapp_number: string | null;
  current_week: number;
  language: string | null;
  open_alerts: number;
  urgent_alerts: number;
  last_alert_at: string | null;
  last_message_at: string | null;
  days_silent: number | null;
  transport_phone: string | null;
  anc_attended: boolean | null;
};

/* Hand-tuned weights, not a learned ranking, on purpose: a CHW has to be able to
   say out loud why she is walking to this mother first, and a funder has to be
   able to audit that reasoning. Every weight below maps 1:1 to a reason string
   printed on the card — if a point can't be explained in English, it isn't here. */
const WEIGHTS = {
  urgentAlert: 100, //  an open urgent danger sign outranks everything else
  openAlert: 40, //     any unresolved alert still needs a human
  silent14: 25, //      two weeks of silence is how mothers quietly leave a programme
  silent7: 12,
  noTransport: 8, //    2nd delay: she can decide to go and still not reach care
  neverAnc: 8, //       never been to ANC — highest risk, least reached
  thirdTrimester: 10, // week >= 28
  term: 15, //          week >= 37: labour could start any day
} as const;

type Scored = { row: WorklistRow; score: number; reasons: string[] };

function scoreRow(r: WorklistRow): Scored {
  const reasons: string[] = [];
  let score = 0;

  if (r.urgent_alerts > 0) {
    score += WEIGHTS.urgentAlert;
    reasons.push(`${r.urgent_alerts} urgent alert${r.urgent_alerts > 1 ? "s" : ""}`);
  }
  if (r.open_alerts > 0) {
    score += WEIGHTS.openAlert;
    // open_alerts already includes the urgent ones — only name the remainder so
    // the card never reads "2 urgent alerts · 2 open alerts" for the same two.
    const other = r.open_alerts - r.urgent_alerts;
    if (other > 0) reasons.push(`${other} open alert${other > 1 ? "s" : ""}`);
  }

  // Silence bands are exclusive: 20 days of silence is one fact about her, not two.
  const silent = r.days_silent;
  if (silent != null && silent > 14) {
    score += WEIGHTS.silent14;
    reasons.push(`silent ${silent} days`);
  } else if (silent != null && silent > 7) {
    score += WEIGHTS.silent7;
    reasons.push(`silent ${silent} days`);
  }

  if (!r.transport_phone) {
    score += WEIGHTS.noTransport;
    reasons.push("no transport plan");
  }
  // null means "we never asked" — only a recorded `false` is evidence she is new to ANC.
  if (r.anc_attended === false) {
    score += WEIGHTS.neverAnc;
    reasons.push("never attended ANC");
  }

  if (r.current_week >= 28) {
    score += WEIGHTS.thirdTrimester;
    if (r.current_week < 37) reasons.push("third trimester");
  }
  if (r.current_week >= 37) {
    score += WEIGHTS.term;
    reasons.push("term — could deliver any day");
  }

  return { row: r, score, reasons };
}

type Tier = { label: string; bg: string; fg: string; bar: string };

/* Pills are pale-background + dark-text rather than solid brand colour: the
   terracotta and honey only hit ~3:1 against white, which fails AA at pill size. */
function tierOf(score: number): Tier {
  if (score >= 100) return { label: "Urgent", bg: "var(--pink-pale)", fg: "#8C3B1E", bar: "var(--pink)" };
  if (score >= 40) return { label: "Soon", bg: "var(--gold-lt)", fg: "#7A5310", bar: "var(--gold)" };
  return { label: "Routine", bg: "var(--lav-pale)", fg: "var(--ink-mid)", bar: "var(--border)" };
}

/* wa.me needs a bare international number. Numbers arrive as local Nigerian
   "0803…", and handing that to WhatsApp silently opens an empty chat — so the
   leading zero becomes the country code before we ever build the link. */
function waDigits(n: string): string {
  return n.replace(/\D/g, "").replace(/^0/, "234");
}

function contactOf(r: WorklistRow): string {
  return r.whatsapp_number || r.phone || "";
}

function lastSeen(r: WorklistRow): string {
  if (r.days_silent == null) return "no messages yet";
  if (r.days_silent <= 0) return "spoke today";
  return `last spoke ${r.days_silent} day${r.days_silent > 1 ? "s" : ""} ago`;
}

const TOP_N = 8;

export default function ChwWorklist({ rows }: { rows: WorklistRow[] }) {
  const scored = useMemo(() => {
    return rows
      .map(scoreRow)
      .sort(
        (a, b) =>
          b.score - a.score ||
          (b.row.days_silent ?? 0) - (a.row.days_silent ?? 0) ||
          b.row.current_week - a.row.current_week
      );
  }, [rows]);

  const top = scored.slice(0, TOP_N);
  const needAttention = scored.filter((s) => s.score >= 40).length;

  return (
    <div style={{ marginBottom: 32 }}>
      <p className="s-label">Your week</p>
      <h2 className="s-title" style={{ marginBottom: 8 }}>
        Who needs you <em>this week</em>
      </h2>

      {rows.length === 0 ? (
        <div className="card" style={{ background: "var(--lav-pale)", border: "none" }}>
          <p style={{ fontFamily: "var(--serif)", fontSize: 22, marginBottom: 8 }}>
            Nobody on your list yet — and that&apos;s alright.
          </p>
          <p className="muted">
            Enrol your first mother below. The moment she&apos;s registered she appears here, sorted by
            who needs you most, with the reason spelled out in plain English.
          </p>
        </div>
      ) : (
        <>
          <p className="muted" style={{ marginBottom: 18 }}>
            {needAttention > 0 ? (
              <>
                <strong style={{ color: "var(--ink)" }}>{needAttention}</strong> of your {rows.length} mothers
                need a call or a visit. Sorted by risk — every card says why.
              </>
            ) : (
              <>
                All {rows.length} of your mothers are steady this week. Sorted by risk anyway — every card
                says why.
              </>
            )}
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {top.map(({ row, score, reasons }) => {
              const tier = tierOf(score);
              const contact = contactOf(row);
              const wa = contact ? waDigits(contact) : "";
              return (
                <div
                  key={row.id}
                  className="card"
                  style={{ padding: "18px 20px", borderLeft: `5px solid ${tier.bar}` }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      gap: 12,
                      flexWrap: "wrap",
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <p style={{ fontFamily: "var(--serif)", fontSize: 20, lineHeight: 1.2 }}>
                        {row.full_name}
                      </p>
                      <p className="muted" style={{ fontSize: 12, marginTop: 2 }}>
                        Week {row.current_week} · {lastSeen(row)}
                        {row.language && row.language !== "en" ? ` · speaks ${row.language}` : ""}
                      </p>
                    </div>
                    <span
                      style={{
                        background: tier.bg,
                        color: tier.fg,
                        borderRadius: 100,
                        padding: "5px 12px",
                        fontSize: 11,
                        fontWeight: 600,
                        letterSpacing: "0.08em",
                        textTransform: "uppercase",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {tier.label}
                    </span>
                  </div>

                  {/* The explainability payload: never show a rank without its reasons. */}
                  <p style={{ marginTop: 10, fontSize: 14, color: "var(--ink-mid)" }}>
                    {reasons.length > 0 ? reasons.join(" · ") : "Routine check-in — nothing flagged."}
                  </p>

                  <div style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
                    {wa && (
                      <a
                        href={`https://wa.me/${wa}`}
                        target="_blank"
                        rel="noreferrer"
                        style={{ ...actionBtn, background: "var(--sage)", color: "#fff" }}
                      >
                        WhatsApp her
                      </a>
                    )}
                    {contact && (
                      <a
                        href={`tel:${contact.replace(/\s/g, "")}`}
                        style={{ ...actionBtn, background: "#fff", color: "var(--ink)", border: "1px solid var(--border)" }}
                      >
                        Call
                      </a>
                    )}
                    {!contact && (
                      <span className="muted" style={{ fontSize: 12, alignSelf: "center" }}>
                        No phone number on file — add one to reach her.
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <details style={{ marginTop: 16 }}>
            <summary
              style={{
                cursor: "pointer",
                minHeight: 44,
                display: "flex",
                alignItems: "center",
                fontSize: 13,
                color: "var(--ink-mid)",
                letterSpacing: "0.04em",
              }}
            >
              All my mothers ({rows.length})
            </summary>
            <div style={{ overflowX: "auto", marginTop: 10 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr>
                    <th style={th}>Mother</th>
                    <th style={th}>Week</th>
                    <th style={th}>Priority</th>
                    <th style={th}>Why</th>
                  </tr>
                </thead>
                <tbody>
                  {scored.map(({ row, score, reasons }) => {
                    const tier = tierOf(score);
                    return (
                      <tr key={row.id}>
                        <td style={td}>{row.full_name}</td>
                        <td style={td}>{row.current_week}</td>
                        <td style={{ ...td, color: tier.fg, fontWeight: 600 }}>
                          {tier.label} ({score})
                        </td>
                        <td style={{ ...td, color: "var(--ink-muted)" }}>
                          {reasons.length > 0 ? reasons.join(" · ") : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </details>
        </>
      )}
    </div>
  );
}

// 44px floor: these are tapped one-handed, outdoors, often on a cracked screen.
const actionBtn: React.CSSProperties = {
  minHeight: 44,
  display: "inline-flex",
  alignItems: "center",
  padding: "0 20px",
  borderRadius: 100,
  fontSize: 13,
  fontWeight: 500,
  letterSpacing: "0.04em",
};

const th: React.CSSProperties = {
  textAlign: "left",
  padding: "8px 10px",
  borderBottom: "1px solid var(--border)",
  fontSize: 10,
  letterSpacing: "0.16em",
  textTransform: "uppercase",
  color: "var(--ink-muted)",
  fontWeight: 500,
  whiteSpace: "nowrap",
};

const td: React.CSSProperties = {
  padding: "10px",
  borderBottom: "1px solid var(--border)",
  verticalAlign: "top",
};
