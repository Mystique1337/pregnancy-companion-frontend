import { NextResponse } from "next/server";
import { getClinician } from "@/lib/clinicianSession";
import { setAlertStatus, setAlertOutcome } from "@/lib/queries";

const OUTCOMES = ["sought_care", "ok", "no_response", "referred"];

export async function POST(req: Request) {
  const clin = await getClinician();
  if (!clin) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  const id = String(b.id || "");
  if (!id) return NextResponse.json({ error: "invalid" }, { status: 400 });

  // Close-the-loop: record the real-world outcome (did she reach care?). This also
  // resolves the alert, and is what powers the impact metric on the dashboard.
  const outcome = String(b.outcome || "");
  if (outcome) {
    if (!OUTCOMES.includes(outcome)) return NextResponse.json({ error: "invalid outcome" }, { status: 400 });
    await setAlertOutcome(id, outcome, clin.name);
    return NextResponse.json({ ok: true });
  }

  const status = String(b.status || "");
  if (!["open", "reviewed", "resolved"].includes(status))
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  await setAlertStatus(id, status, clin.name);
  return NextResponse.json({ ok: true });
}
