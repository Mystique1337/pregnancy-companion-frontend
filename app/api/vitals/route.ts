import { NextResponse, after } from "next/server";
import { getSession } from "@/lib/session";
import { getMotherById, addVital, listVitals, latestVital, createAlert } from "@/lib/queries";
import { currentWeekFrom } from "@/lib/babyData";
import { evaluateVital, evaluateWeightTrend, vitalMeta, plausibilityError, type VitalKind } from "@/lib/vitals";
import { sendAlert } from "@/lib/notify";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const vitals = await listVitals(session.sub);
  return NextResponse.json({ vitals });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const mother = await getMotherById(session.sub);
  if (!mother) return NextResponse.json({ error: "not found" }, { status: 404 });

  const b = await req.json().catch(() => ({}));
  const kind = String(b.kind || "") as VitalKind;
  const meta = vitalMeta(kind);
  if (!meta) return NextResponse.json({ error: "invalid kind" }, { status: 400 });

  const value = b.value != null && b.value !== "" ? Number(b.value) : null;
  const value2 = b.value2 != null && b.value2 !== "" ? Number(b.value2) : null;
  if (value == null || Number.isNaN(value)) return NextResponse.json({ error: "A value is required." }, { status: 400 });
  if (meta.dual && (value2 == null || Number.isNaN(value2))) return NextResponse.json({ error: "Both numbers are required." }, { status: 400 });

  // Reject impossible readings (typos) — otherwise a stray digit stores junk AND
  // fires a false urgent "go to hospital now" alert to her and her clinician.
  const implausible = plausibilityError(kind, value, value2);
  if (implausible) return NextResponse.json({ error: implausible }, { status: 400 });

  const week = currentWeekFrom({ dueDate: mother.due_date, enteredWeek: mother.current_week, createdAt: mother.created_at });

  // Capture previous weight before inserting (for the trend check).
  let prevWeight: number | null = null;
  let prevAt: string | null = null;
  if (kind === "weight") {
    const p = await latestVital(mother.id, "weight");
    if (p) { prevWeight = p.value != null ? Number(p.value) : null; prevAt = p.created_at; }
  }

  const vital = await addVital(mother.id, { kind, value, value2, unit: meta.unit, note: String(b.note || "").trim() || undefined, week });

  let alert = evaluateVital(kind, value, value2);
  if (!alert && kind === "weight" && prevWeight != null && prevAt) {
    const days = (Date.now() - new Date(prevAt).getTime()) / 86400000;
    alert = evaluateWeightTrend(value, prevWeight, days);
  }

  if (alert) {
    await createAlert(mother.id, { level: alert.level, kind: alert.kind, message: alert.message, vitalId: vital.id });
    const a = alert;
    after(async () => { await sendAlert(mother, a); });
    return NextResponse.json({ ok: true, vital, alert: { level: a.level, message: a.message } });
  }

  return NextResponse.json({ ok: true, vital });
}
