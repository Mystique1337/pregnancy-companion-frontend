import { NextResponse, after } from "next/server";
import { getSession } from "@/lib/session";
import { getMotherById, createAlert } from "@/lib/queries";
import { assessTriage } from "@/lib/triage";
import { sendAlert } from "@/lib/notify";

export const maxDuration = 30;

// Records a symptom-checker outcome. The level is RECOMPUTED here from the
// symptom + answers (never trusted from the client). Emergency/urgent outcomes
// raise an alert so the clinician portal + the mother's notifications pick it up.
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const mother = await getMotherById(session.sub);
  if (!mother) return NextResponse.json({ error: "not found" }, { status: 404 });

  const b = await req.json().catch(() => ({}));
  const symptomId = String(b.symptomId || "");
  const yesIds: string[] = Array.isArray(b.yes) ? b.yes.map(String) : [];

  const result = assessTriage(symptomId, yesIds);
  if (!result) return NextResponse.json({ error: "invalid symptom" }, { status: 400 });

  const { level, symptom } = result;
  if (level === "emergency" || level === "urgent") {
    const flagged = symptom.questions.filter((q) => yesIds.includes(q.id)).map((q) => q.text);
    const message =
      level === "emergency"
        ? `Symptom check flagged EMERGENCY for "${symptom.label}". Advised to seek care now.`
        : `Symptom check flagged "${symptom.label}" as needing same-day provider contact.`;
    const detail = flagged.length ? ` Reported: ${flagged.join("; ")}` : "";
    const alertLevel = level === "emergency" ? "urgent" : "warning";
    const alert = await createAlert(mother.id, { level: alertLevel, kind: "symptom", message: message + detail });
    after(async () => { await sendAlert(mother, { level: alertLevel, message: message + detail }); });
    return NextResponse.json({ ok: true, level, alertId: alert.id });
  }

  return NextResponse.json({ ok: true, level });
}
