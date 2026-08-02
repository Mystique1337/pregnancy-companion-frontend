import { NextResponse, after } from "next/server";
import { getSession } from "@/lib/session";
import { getMotherById, createAlert, updateEmergencyContact } from "@/lib/queries";
import { findHospitals } from "@/lib/hospitals";
import { sendAlert } from "@/lib/notify";
import { dispatchTransport, hasTransportPlan } from "@/lib/transport";
import { alertPartnerDanger } from "@/lib/partner";
import { newReferralCode } from "@/lib/referral";
import { setAlertReferral, logAudit } from "@/lib/queries";

export const maxDuration = 30;

// Save / update the next-of-kin contact.
export async function PUT(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  const name = String(b.name || "").trim().slice(0, 80) || null;
  const phone = String(b.phone || "").trim().slice(0, 30) || null;
  await updateEmergencyContact(session.sub, name, phone);
  return NextResponse.json({ ok: true });
}

// Trigger Emergency Mode: raise an URGENT alert (clinician portal picks it up),
// notify the mother's channels, and return the nearest hospitals + her contact
// so the client can offer a one-tap "alert my next-of-kin" link.
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const mother = await getMotherById(session.sub);
  if (!mother) return NextResponse.json({ error: "not found" }, { status: 404 });

  const b = await req.json().catch(() => ({}));
  const lat = Number(b.lat), lon = Number(b.lon);
  const hasLoc = Number.isFinite(lat) && Number.isFinite(lon);
  const locText = hasLoc ? ` Location: https://maps.google.com/?q=${lat},${lon}` : " (location not shared)";

  const alert = await createAlert(mother.id, {
    level: "urgent",
    kind: "emergency",
    message: `🚨 EMERGENCY MODE triggered by ${mother.full_name}.${locText}`,
  });

  // Issue a referral code so her arrival at the facility can be confirmed — that
  // is what turns "we alerted someone" into a measured time-to-care.
  const referralCode = newReferralCode();
  await setAlertReferral(alert.id, referralCode, mother.facility_name ?? null).catch(() => {});

  const mapsUrl = hasLoc ? `https://maps.google.com/?q=${lat},${lon}` : null;
  // Fan out: her own channels, the people who physically get her there (Delay 2),
  // and the decision-maker who says yes to going.
  after(async () => {
    await sendAlert(mother, { level: "urgent", message: `Emergency Mode is active. If this is a real emergency, get to the nearest hospital now. Show code ${referralCode} at the clinic.${locText}` }).catch(() => {});
    await dispatchTransport(mother, { mapsUrl }).catch(() => {});
    await alertPartnerDanger(mother, "emergency mode", mapsUrl).catch(() => {});
    logAudit({ mother_id: mother.id, actor: "mother", action: "emergency_triggered", channel: "web", summary: referralCode, meta: { hasLoc } });
  });

  let hospitals: Awaited<ReturnType<typeof findHospitals>> = [];
  if (hasLoc) {
    try { hospitals = (await findHospitals(lat, lon, 12000)).slice(0, 6); } catch { /* return without list */ }
  }

  return NextResponse.json({
    ok: true,
    referralCode,
    transportPlan: hasTransportPlan(mother)
      ? { name: mother.transport_name, phone: mother.transport_phone }
      : null,
    hospitals,
    contact: mother.emergency_contact_name || mother.emergency_contact_phone
      ? { name: mother.emergency_contact_name, phone: mother.emergency_contact_phone }
      : null,
    motherName: mother.full_name,
  });
}
