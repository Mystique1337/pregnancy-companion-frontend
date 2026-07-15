import { NextResponse, after } from "next/server";
import { getMotherByPhone, createAlert } from "@/lib/queries";
import { getSettings } from "@/lib/settings";
import { bumplyReply } from "@/lib/companion";
import { sendText, webhookSecret } from "@/lib/evolution";
import { detectDangerSign, dangerReply } from "@/lib/dangerSigns";

export const dynamic = "force-dynamic";
export const maxDuration = 120; // give the AI round-trip + delayed send room to finish in after()

// Evolution can verify the URL with a GET.
export async function GET() {
  return NextResponse.json({ ok: true });
}

type WAMessage = {
  conversation?: string;
  extendedTextMessage?: { text?: string };
  ephemeralMessage?: { message?: WAMessage };
};

function extractText(msg: WAMessage | undefined): string {
  if (!msg) return "";
  return (
    msg.conversation ||
    msg.extendedTextMessage?.text ||
    msg.ephemeralMessage?.message?.extendedTextMessage?.text ||
    ""
  ).trim();
}

export async function POST(req: Request) {
  // Shared-secret guard so only our Evolution instance can post here.
  const url = new URL(req.url);
  const secret = webhookSecret();
  if (secret && url.searchParams.get("secret") !== secret) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const event = String(body.event || body.type || "");
  if (event && !/messages[._]upsert/i.test(event)) {
    return NextResponse.json({ ok: true, ignored: event });
  }

  const raw = body.data;
  const entries = Array.isArray(raw) ? raw : raw ? [raw] : [];

  // Acknowledge fast; do the AI round-trip + reply after responding.
  after(async () => {
    for (const d of entries) {
      try {
        const key = d?.key || {};
        if (key.fromMe) continue; // ignore our own messages
        const jid = String(key.remoteJid || "");
        if (!jid || jid.endsWith("@g.us") || jid === "status@broadcast") continue; // skip groups/status
        const text = extractText(d?.message);
        if (!text) continue;

        const phone = jid.split("@")[0].replace(/\D/g, "");
        const mother = await getMotherByPhone(phone);
        if (!mother) continue; // don't reply to strangers

        const settings = await getSettings();
        if (!settings.chat_enabled) continue;

        if (process.env.WHATSAPP_CHAT_REQUIRES_PREMIUM === "true" && mother.plan !== "premium") {
          const first = mother.full_name.split(" ")[0];
          const link = process.env.APP_URL ? ` ${process.env.APP_URL}/pricing` : "";
          await sendText(phone, `Hi ${first} 🌸 One-on-one chat with me is a premium feature. Upgrade in your Bumply dashboard and I'll be here any time, day or night!${link}`);
          continue;
        }

        // Danger-sign fast path: deterministic, BEFORE the AI. A red flag always
        // gets an immediate, correct urgent reply + a clinician alert.
        const danger = detectDangerSign(text);
        if (danger) {
          const first = mother.full_name.split(" ")[0];
          await sendText(phone, dangerReply(first, danger));
          const level = danger.level === "emergency" ? "urgent" : "warning";
          await createAlert(mother.id, {
            level,
            kind: "danger-sign",
            message: `WhatsApp danger sign — ${danger.sign}: "${text.slice(0, 160)}"`,
          }).catch(() => {});
          console.log(`[wa] DANGER (${danger.sign}) from ${phone} (${mother.full_name})`);
          continue;
        }

        const reply = await bumplyReply(mother, text);
        const sent = await sendText(phone, reply);
        console.log(`[wa] reply to ${phone} (${mother.full_name}): sent=${sent.ok}${sent.error ? ` error=${sent.error}` : ""}`);
      } catch (e) {
        console.error("whatsapp webhook handler error:", e);
      }
    }
  });

  return NextResponse.json({ ok: true });
}
