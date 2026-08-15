// One-click way into a populated account, for judges, funders and anyone who
// scans the QR mid-pitch. Signing up is short, but it is still friction at the
// exact moment someone is curious, and a blank dashboard shows nothing.
//
// Seeds the shared demo mother on first hit, opens a session, and drops the
// visitor on the dashboard. Set DEMO_ACCOUNT_ENABLED=false to turn it off.
import { NextResponse } from "next/server";
import { createSession } from "@/lib/session";
import { ensureDemoMother } from "@/lib/demoAccount";
import { publicBaseUrl } from "@/lib/baseUrl";

/** Where the visitor actually came from.
 *  Behind a reverse proxy req.url is the container's internal address
 *  (http://0.0.0.0:3000/...), so redirecting against it sends people nowhere.
 *  Trust the proxy's forwarded headers first, then the configured public URL,
 *  and only fall back to the request itself for direct local access. */
function externalOrigin(req: Request): string {
  const h = req.headers;
  const host = h.get("x-forwarded-host") || h.get("host");
  // 0.0.0.0 and [::] are bind addresses, not reachable hosts. localhost and
  // 127.0.0.1 are fine and are what local development actually serves on.
  if (host && !/^(0\.0\.0\.0|\[::\])/.test(host)) {
    const local = /^(localhost|127\.0\.0\.1)/.test(host);
    const proto = h.get("x-forwarded-proto") || (local ? "http" : "https");
    return `${proto}://${host}`;
  }
  return publicBaseUrl() || new URL(req.url).origin;
}

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (process.env.DEMO_ACCOUNT_ENABLED === "false") {
    return NextResponse.redirect(new URL("/login", externalOrigin(req)));
  }
  try {
    const mother = await ensureDemoMother();
    await createSession({ sub: mother.id, email: mother.email });
    return NextResponse.redirect(new URL("/dashboard", externalOrigin(req)));
  } catch (e) {
    // Never dead-end a visitor: if the database is unreachable, send them to
    // the normal sign-in rather than showing a stack trace.
    console.error("[demo] could not open demo session:", e);
    return NextResponse.redirect(new URL("/login?demo=unavailable", externalOrigin(req)));
  }
}
