import { NextResponse } from "next/server";
import { getClinician } from "@/lib/clinicianSession";
import { confirmArrivalByCode, logAudit, type Alert } from "@/lib/queries";

/* `returning *` hands back the referral columns too; the shared Alert type only
   models the ones every caller needs, so widen it here rather than loosening it
   for everyone else. */
type ArrivedAlert = Alert & { arrived_at?: string | null; referral_code?: string | null };

export async function POST(req: Request) {
  const clin = await getClinician();
  if (!clin) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const b: unknown = await req.json().catch(() => ({}));
  const body = (b ?? {}) as { code?: unknown; facility?: unknown };
  const code = String(body.code || "").trim();
  if (!code) return NextResponse.json({ error: "invalid" }, { status: 400 });
  const facility = body.facility ? String(body.facility).slice(0, 200) : null;

  const alert = (await confirmArrivalByCode(code, facility)) as ArrivedAlert | null;
  if (!alert) return NextResponse.json({ error: "unknown code" }, { status: 404 });

  // Danger sign -> facility door. This one number is the programme's outcome
  // claim, so it is computed from timestamps we wrote, never from self-report.
  const raised = new Date(alert.created_at).getTime();
  const arrived = alert.arrived_at ? new Date(alert.arrived_at).getTime() : Date.now();
  const minutesToCare = Math.max(0, Math.round((arrived - raised) / 60000));

  logAudit({
    mother_id: alert.mother_id,
    actor: "chw",
    action: "arrival_confirmed",
    summary: `${clin.name} confirmed arrival on ${code} after ${minutesToCare} min`,
    meta: { alertId: alert.id, code, facility, minutesToCare, clinician: clin.sub },
  });

  return NextResponse.json({ ok: true, alertId: alert.id, minutesToCare });
}
