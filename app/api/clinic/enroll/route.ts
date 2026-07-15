import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { getClinician } from "@/lib/clinicianSession";
import { getMotherByPhone, createMother, assignChw } from "@/lib/queries";
import { currentWeekFrom, trimesterFor } from "@/lib/babyData";
import { normalizeLang } from "@/lib/languages";

// A CHW enrolls a mother by phone. If she already has an account, just link her to
// this CHW; otherwise create a minimal record (she uses Bumply via WhatsApp/SMS,
// not a password login).
export async function POST(req: Request) {
  const clin = await getClinician();
  if (!clin) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const b = await req.json().catch(() => ({}));
  const full_name = String(b.full_name || "").trim();
  const phone = String(b.phone || "").trim();
  const digits = phone.replace(/\D/g, "");
  if (!full_name || digits.length < 10) return NextResponse.json({ error: "Name and a valid phone number are required." }, { status: 400 });

  const existing = await getMotherByPhone(phone);
  if (existing) {
    await assignChw(existing.id, clin.sub);
    return NextResponse.json({ ok: true, linked: true, name: existing.full_name });
  }

  const enteredWeek = Number.isInteger(Number(b.current_week)) ? Number(b.current_week) : null;
  const week = currentWeekFrom({ dueDate: String(b.due_date || "").trim() || null, enteredWeek });
  const email = `wa${digits}@bumply.chw`;
  const password_hash = await bcrypt.hash(randomBytes(12).toString("hex"), 10);

  try {
    const mother = await createMother({
      email,
      password_hash,
      full_name,
      phone,
      whatsapp_number: phone,
      due_date: String(b.due_date || "").trim() || undefined,
      current_week: week,
      weeks_completed: week,
      trimester: trimesterFor(week),
      first_pregnancy: true,
      source: "chw",
      language: normalizeLang(b.language),
    });
    await assignChw(mother.id, clin.sub);
    return NextResponse.json({ ok: true, motherId: mother.id });
  } catch (e) {
    // Most likely a duplicate email (already enrolled) — treat gracefully.
    const existing2 = await getMotherByPhone(phone);
    if (existing2) { await assignChw(existing2.id, clin.sub); return NextResponse.json({ ok: true, linked: true }); }
    console.error("chw enroll error:", e);
    return NextResponse.json({ error: "Could not enrol her right now." }, { status: 500 });
  }
}
