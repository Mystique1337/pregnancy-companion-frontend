// "Flag this answer" — the clinical-quality feedback loop.
// Either the mother who received an AI answer or a clinician reviewing one can
// flag it; the row lands in preg_companion.ai_feedback for periodic clinical
// review (see docs/GOVERNANCE.md). Attribution is explicit so a reviewer can tell
// mother-reported and clinician-reported problems apart.
import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getClinician } from "@/lib/clinicianSession";
import { flagAiAnswer, logAudit } from "@/lib/queries";

export const dynamic = "force-dynamic";

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

export async function POST(req: Request) {
  const [session, clinician] = await Promise.all([getSession(), getClinician()]);
  if (!session && !clinician) {
    return NextResponse.json({ error: "Please sign in to send feedback." }, { status: 401 });
  }

  const body: unknown = await req.json().catch(() => null);
  const b = (typeof body === "object" && body !== null ? body : {}) as Record<string, unknown>;
  const message = str(b.message).slice(0, 2000);
  const reason = str(b.reason).slice(0, 200) || "unspecified";
  if (!message) {
    return NextResponse.json({ error: "Tell us which answer was wrong." }, { status: 400 });
  }

  // A clinician's flag is about someone else's answer, so they may name the mother;
  // a mother's flag is always about her own. Clinician attribution wins when both
  // cookies are present (shared device in a clinic).
  const flaggedBy = clinician ? `clinician:${clinician.name}` : "mother";
  const motherId = clinician ? str(b.motherId) || null : session?.sub ?? null;

  try {
    await flagAiAnswer(motherId, message, reason, flaggedBy);
  } catch (e) {
    console.error("[feedback] flag write failed:", e);
    return NextResponse.json({ error: "We could not save that right now. Please try again." }, { status: 500 });
  }

  logAudit({
    mother_id: motherId,
    actor: clinician ? "chw" : "mother",
    action: "ai_answer_flagged",
    channel: "web",
    summary: reason.slice(0, 200),
  });

  return NextResponse.json({ ok: true });
}
