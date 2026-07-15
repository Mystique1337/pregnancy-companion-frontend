import { NextResponse, after } from "next/server";
import { getMotherByEmail } from "@/lib/queries";
import { createResetToken } from "@/lib/session";
import { sendEmail, FROM } from "@/lib/email";
import { publicBaseUrl } from "@/lib/baseUrl";

export const maxDuration = 30;

// Always returns ok (don't leak whether an account exists). If it does, email a
// 1-hour reset link from account@bumply.mom.
export async function POST(req: Request) {
  const b = await req.json().catch(() => ({}));
  const email = String(b.email || "").trim().toLowerCase();
  if (!email) return NextResponse.json({ ok: true });

  const mother = await getMotherByEmail(email);
  if (mother) {
    const token = await createResetToken(mother.id, mother.email);
    const base = publicBaseUrl() || "";
    const link = `${base}/reset-password?token=${encodeURIComponent(token)}`;
    const first = (mother.full_name || "mama").split(" ")[0];
    after(async () => {
      const html = `<!DOCTYPE html><html><body style="margin:0;background:#FBF7F1;font-family:'DM Sans',system-ui,Arial,sans-serif;color:#2E2620;line-height:1.7">
        <div style="max-width:520px;margin:0 auto;padding:32px 20px">
          <div style="background:#fff;border:1px solid rgba(46,38,32,.08);border-radius:20px;padding:32px 28px">
            <div style="font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:#C97B5A;font-weight:700">Reset your password</div>
            <h1 style="font-family:Georgia,serif;font-weight:400;font-size:26px;margin:10px 0">Hello, ${first} 🌸</h1>
            <p style="margin:0 0 18px;color:#5B4A3E">Tap the button below to set a new password. This link works for the next hour. If you didn't ask for this, you can ignore this email.</p>
            ${link ? `<a href="${link}" style="display:inline-block;background:#C97B5A;color:#fff;text-decoration:none;padding:13px 26px;border-radius:100px;font-weight:600">Set a new password →</a>` : ""}
          </div>
          <p style="text-align:center;color:#9a8576;font-size:12px;margin-top:16px">With love, Bumply</p>
        </div></body></html>`;
      await sendEmail(mother.email, "Reset your Bumply password", html, undefined, FROM.account).catch(() => {});
    });
  }

  return NextResponse.json({ ok: true });
}
