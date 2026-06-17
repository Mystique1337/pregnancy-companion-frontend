import { NextResponse, after } from "next/server";
import { getSession } from "@/lib/session";
import { getMotherById, createAlert } from "@/lib/queries";
import { scoreMood } from "@/lib/mood";
import { sendAlert } from "@/lib/notify";

export const maxDuration = 30;

// Score a wellbeing self-check. Recomputed server-side. Elevated/urgent results
// (or any self-harm signal) raise an alert so a clinician follows up.
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const mother = await getMotherById(session.sub);
  if (!mother) return NextResponse.json({ error: "not found" }, { status: 404 });

  const b = await req.json().catch(() => ({}));
  const answers = (b.answers && typeof b.answers === "object") ? b.answers : {};
  const result = scoreMood(answers);

  if (result.band === "elevated" || result.band === "urgent") {
    const level = result.band === "urgent" ? "urgent" : "warning";
    const msg = result.selfHarmFlag
      ? `Wellbeing check flagged a SELF-HARM signal (score ${result.score}/30). Please follow up urgently.`
      : `Wellbeing check flagged low mood (score ${result.score}/30, ${result.band}).`;
    await createAlert(mother.id, { level, kind: "mood", message: msg }).catch(() => {});
    after(async () => { await sendAlert(mother, { level, message: result.message }).catch(() => {}); });
  }

  return NextResponse.json({ ok: true, result });
}
