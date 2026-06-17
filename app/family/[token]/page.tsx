import { getMotherByFamilyToken, getWeeklyUpdateByWeek } from "@/lib/queries";
import { currentWeekFrom, trimesterFor, getBabyData, babySizeText } from "@/lib/babyData";

export const dynamic = "force-dynamic";

// PUBLIC, read-only "family companion" view. Shows only warm, shareable weekly
// content — never vitals, mood, alerts or any medical data. Access is by the
// unguessable token only (not behind auth middleware).
export default async function FamilyView({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const mother = await getMotherByFamilyToken(token);

  if (!mother) {
    return (
      <div style={wrap}>
        <div style={card}>
          <h1 style={{ fontFamily: "Georgia, serif", fontWeight: 400, fontSize: 26 }}>This link isn&apos;t active</h1>
          <p style={{ color: "#6b5a4d", marginTop: 8 }}>Ask your loved one to share their Bumply family link again. 🌸</p>
        </div>
      </div>
    );
  }

  const first = (mother.full_name || "Mama").split(" ")[0];
  const week = currentWeekFrom({ dueDate: mother.due_date, enteredWeek: mother.current_week, createdAt: mother.created_at });
  const baby = getBabyData(week);
  const size = baby ? babySizeText(week) : "growing beautifully 🌱";
  const update = await getWeeklyUpdateByWeek(mother.id, week);
  const partner = update?.partner_section || [];
  const weeksToGo = Math.max(0, 40 - week);

  return (
    <div style={wrap}>
      <div style={{ maxWidth: 560, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 18 }}>
          <div style={{ fontSize: 11, letterSpacing: ".18em", textTransform: "uppercase", color: "#C97B5A", fontWeight: 700 }}>Bumply · Family</div>
          <h1 style={{ fontFamily: "Georgia, serif", fontWeight: 400, fontSize: 30, margin: "8px 0 4px" }}>{first}&apos;s journey 🌸</h1>
          <p style={{ color: "#6b5a4d" }}>Week {week} · {trimesterFor(week)} trimester · {weeksToGo} weeks to go</p>
        </div>

        <div style={{ ...card, background: "linear-gradient(135deg,#F6E9E1,#EDF1E7)", textAlign: "center", marginBottom: 16 }}>
          <p style={{ fontSize: 11, letterSpacing: ".12em", textTransform: "uppercase", color: "#C97B5A", fontWeight: 700 }}>This week</p>
          <p style={{ fontFamily: "Georgia, serif", fontSize: 22, margin: "8px 0" }}>Baby is {size}</p>
          {baby?.development && <p style={{ color: "#5B4A3E", fontSize: 14 }}>{baby.development}</p>}
        </div>

        {partner.length > 0 && (
          <div style={{ ...card, marginBottom: 16 }}>
            <p style={{ fontSize: 11, letterSpacing: ".12em", textTransform: "uppercase", color: "#C97B5A", fontWeight: 700, marginBottom: 12 }}>How to support her this week</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {partner.map((p, i) => (
                <div key={i}>
                  <p style={{ fontWeight: 600, fontSize: 15 }}>{p.title}</p>
                  <p style={{ color: "#6b5a4d", fontSize: 14, marginTop: 2 }}>{p.description}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {update?.affirmation && (
          <div style={{ ...card, textAlign: "center", marginBottom: 16 }}>
            <p style={{ fontFamily: "Georgia, serif", fontStyle: "italic", fontSize: 18, color: "#9CAF88" }}>&ldquo;{update.affirmation}&rdquo;</p>
          </div>
        )}

        <p style={{ textAlign: "center", color: "#9a8576", fontSize: 12 }}>
          You&apos;re seeing a private update {first} chose to share. Walk with her. 💛<br />
          <a href="/" style={{ color: "#C97B5A", textDecoration: "none" }}>What is Bumply? →</a>
        </p>
      </div>
    </div>
  );
}

const wrap: React.CSSProperties = { background: "#FBF7F1", minHeight: "100vh", padding: "36px 18px", fontFamily: "'DM Sans', system-ui, sans-serif", color: "#2E2620", lineHeight: 1.6 };
const card: React.CSSProperties = { background: "#fff", border: "1px solid rgba(46,38,32,0.10)", borderRadius: 18, padding: "22px 24px" };
