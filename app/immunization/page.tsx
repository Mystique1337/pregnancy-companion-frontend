import { getSession } from "@/lib/session";
import { getMotherById } from "@/lib/queries";
import { immunizationPlan, type VisitStatus } from "@/lib/immunization";
import AppHeader from "../_components/AppHeader";

export const dynamic = "force-dynamic";

const STATUS_STYLE: Record<VisitStatus, { bg: string; label: string }> = {
  due: { bg: "var(--pink-pale)", label: "Due now" },
  upcoming: { bg: "var(--lav-pale)", label: "Upcoming" },
  done: { bg: "#eef4ee", label: "Past" },
};

export default async function ImmunizationPage() {
  const session = await getSession();
  const mother = session ? await getMotherById(session.sub) : null;
  const birth = mother?.birth_date || null;
  const { weeks, visits } = immunizationPlan(birth, new Date());

  return (
    <>
      {mother && <AppHeader plan={mother.plan} lang={mother.language} active="dashboard" features={{ journal: false, tools: false, chat: false }} />}
      <div className="app-shell" style={{ maxWidth: 680 }}>
        <p className="s-label">Free at your health centre</p>
        <h1 className="s-title" style={{ marginBottom: 8 }}>Baby immunization schedule</h1>
        <p className="muted" style={{ marginBottom: 20 }}>
          Nigeria&apos;s routine vaccines protect your baby from measles, polio, pneumonia, tuberculosis and more.
          They are <strong>free</strong>. {birth ? `Your baby is about ${weeks} week${weeks === 1 ? "" : "s"} old.` : "Times are counted from your baby's birth day."}
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {visits.map((v) => {
            const s = STATUS_STYLE[v.status];
            return (
              <div key={v.label} className="card" style={{ background: s.bg, border: "none" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
                  <p style={{ fontFamily: "var(--serif)", fontSize: 20 }}>{v.label}</p>
                  <span className="muted" style={{ fontSize: 12 }}>
                    {birth ? s.label : ""}{v.dueDate && v.status !== "done" ? ` · ${v.dueDate}` : ""}
                  </span>
                </div>
                <ul style={{ margin: "8px 0 0", paddingLeft: 18, lineHeight: 1.7 }}>
                  {v.vaccines.map((vac) => (
                    <li key={vac.name}><strong>{vac.name}</strong> <span className="muted" style={{ fontSize: 13 }}>— {vac.protects}</span></li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>

        <p className="muted" style={{ fontSize: 12, marginTop: 20 }}>
          If your baby misses a dose, don&apos;t restart — just go as soon as you can and the health worker will continue.
          Bring your baby&apos;s immunization card to every visit.
        </p>
      </div>
    </>
  );
}
