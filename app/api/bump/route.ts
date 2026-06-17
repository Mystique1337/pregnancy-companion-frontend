import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getMotherById, addBumpPhoto, listBumpPhotos, deleteBumpPhoto } from "@/lib/queries";
import { currentWeekFrom } from "@/lib/babyData";

export const maxDuration = 30;

const MAX_BYTES = 4 * 1024 * 1024; // 4MB safety cap (client compresses well below this)

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const photos = await listBumpPhotos(session.sub);
  return NextResponse.json({ photos });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const mother = await getMotherById(session.sub);
  if (!mother) return NextResponse.json({ error: "not found" }, { status: 404 });

  const b = await req.json().catch(() => ({}));
  const dataUrl = String(b.dataUrl || "");
  const m = dataUrl.match(/^data:(image\/(?:jpeg|png|webp));base64,(.+)$/);
  if (!m) return NextResponse.json({ error: "Please choose a JPEG, PNG or WebP image." }, { status: 400 });

  const buf = Buffer.from(m[2], "base64");
  if (buf.length === 0) return NextResponse.json({ error: "That image looks empty." }, { status: 400 });
  if (buf.length > MAX_BYTES) return NextResponse.json({ error: "That image is too large — please try a smaller photo." }, { status: 413 });

  const defaultWeek = currentWeekFrom({ dueDate: mother.due_date, enteredWeek: mother.current_week, createdAt: mother.created_at });
  const week = b.week != null && b.week !== "" ? Math.max(1, Math.min(45, Number(b.week))) : defaultWeek;
  const note = String(b.note || "").trim().slice(0, 280) || undefined;

  const photo = await addBumpPhoto(mother.id, { week: Number.isFinite(week) ? week : null, note, mime: m[1], data: buf });
  return NextResponse.json({ ok: true, photo });
}

export async function DELETE(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  await deleteBumpPhoto(id, session.sub);
  return NextResponse.json({ ok: true });
}
