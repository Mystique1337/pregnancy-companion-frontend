import { NextResponse } from "next/server";
import { getClinician } from "@/lib/clinicianSession";
import { logAudit, setAlertReferral } from "@/lib/queries";
import { newReferralCode } from "@/lib/referral";

/* Deliberately reusing the same generator the WhatsApp webhook uses: a code
   issued by a clinician here and one auto-issued to a mother there have to be
   the same shape, or findReferralCode() stops recognising half of them when a
   facility texts back "arrived BMP-4KX9". One alphabet, one format, one loop. */

export async function POST(req: Request) {
  const clin = await getClinician();
  if (!clin) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const b: unknown = await req.json().catch(() => ({}));
  const body = (b ?? {}) as { alertId?: unknown; facility?: unknown };
  const alertId = String(body.alertId || "");
  if (!alertId) return NextResponse.json({ error: "invalid" }, { status: 400 });
  const facility = body.facility ? String(body.facility).slice(0, 200) : null;

  const code = newReferralCode();
  await setAlertReferral(alertId, code, facility);
  logAudit({
    actor: "chw",
    action: "referral_issued",
    summary: `${clin.name} issued ${code}${facility ? ` to ${facility}` : ""}`,
    meta: { alertId, code, facility, clinician: clin.sub },
  });

  // Hand back a line the CHW can paste straight into WhatsApp or SMS — the code
  // is worthless unless the mother physically carries it to the facility desk.
  return NextResponse.json({ ok: true, code, smsText: `Show this code at the clinic: ${code}` });
}
