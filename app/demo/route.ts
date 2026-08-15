// One-click way into a populated account, for judges, funders and anyone who
// scans the QR mid-pitch. Signing up is short, but it is still friction at the
// exact moment someone is curious, and a blank dashboard shows nothing.
//
// Seeds the shared demo mother on first hit, opens a session, and drops the
// visitor on the dashboard. Set DEMO_ACCOUNT_ENABLED=false to turn it off.
import { NextResponse } from "next/server";
import { createSession } from "@/lib/session";
import { ensureDemoMother } from "@/lib/demoAccount";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (process.env.DEMO_ACCOUNT_ENABLED === "false") {
    return NextResponse.redirect(new URL("/login", req.url));
  }
  try {
    const mother = await ensureDemoMother();
    await createSession({ sub: mother.id, email: mother.email });
    // Redirect against the incoming request, not APP_URL: if APP_URL is stale or
    // wrong the demo link would silently send visitors to another host.
    return NextResponse.redirect(new URL("/dashboard", req.url));
  } catch (e) {
    // Never dead-end a visitor: if the database is unreachable, send them to
    // the normal sign-in rather than showing a stack trace.
    console.error("[demo] could not open demo session:", e);
    return NextResponse.redirect(new URL("/login?demo=unavailable", req.url));
  }
}
