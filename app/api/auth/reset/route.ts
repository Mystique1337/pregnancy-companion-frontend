import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { updateMotherPassword, getMotherById } from "@/lib/queries";
import { verifyResetToken, createSession } from "@/lib/session";

export async function POST(req: Request) {
  const b = await req.json().catch(() => ({}));
  const token = String(b.token || "");
  const password = String(b.password || "");

  if (password.length < 8)
    return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });

  const claim = await verifyResetToken(token);
  if (!claim) return NextResponse.json({ error: "This reset link is invalid or has expired. Please request a new one." }, { status: 400 });

  const mother = await getMotherById(claim.sub);
  if (!mother) return NextResponse.json({ error: "Account not found." }, { status: 404 });

  await updateMotherPassword(mother.id, await bcrypt.hash(password, 10));
  // Log her straight in after a successful reset.
  await createSession({ sub: mother.id, email: mother.email });
  return NextResponse.json({ ok: true });
}
