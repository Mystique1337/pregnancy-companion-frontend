// NDPA 2023 right to erasure, exercised from the web account page.
// Deliberately hard to fire by accident: POST only, session-authenticated, and the
// body must carry the literal confirmation word. The chat-channel equivalent lives
// in the WhatsApp/Telegram webhooks (see lib/consent.ts → isDeleteRequest).
import { NextResponse } from "next/server";
import { getSession, destroySession } from "@/lib/session";
import { eraseMotherData, logAudit } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Please sign in." }, { status: 401 });

  const body: unknown = await req.json().catch(() => null);
  const confirm =
    typeof body === "object" && body !== null && "confirm" in body
      ? (body as { confirm?: unknown }).confirm
      : undefined;
  if (confirm !== "DELETE") {
    return NextResponse.json(
      { error: 'Confirmation required. Send {"confirm":"DELETE"} to erase your data.' },
      { status: 422 }
    );
  }

  try {
    // Wipes her content, anonymises her audit/misinfo rows and tombstones the
    // mother record (lib/queries.ts). Irreversible by design.
    await eraseMotherData(session.sub);
  } catch (e) {
    console.error("[account/delete] erasure failed:", e);
    return NextResponse.json({ error: "We could not complete that right now. Please try again." }, { status: 500 });
  }

  // Audit the CHANNEL of the request without re-attaching her id — eraseMotherData
  // has just detached every audit row from her, and we must not undo that.
  logAudit({ actor: "mother", action: "data_deleted", channel: "web", summary: "erasure requested from account page" });

  await destroySession();
  return NextResponse.json({ ok: true });
}
