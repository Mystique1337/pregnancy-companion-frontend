import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify, SignJWT } from "jose";

const secret = new TextEncoder().encode(process.env.AUTH_SECRET || "dev-insecure-secret-change-me");
const COOKIE = "bumply_session";
const DAY = 24 * 60 * 60 * 1000;

export async function middleware(req: NextRequest) {
  const token = req.cookies.get(COOKIE)?.value;
  if (token) {
    try {
      const { payload } = await jwtVerify(token, secret);
      const res = NextResponse.next();
      // Sliding session: refresh the 30-day cookie for anyone who's active, so a
      // returning mother never gets silently logged out (and forced to re-sign-up).
      // Only re-sign when the token is a day old, to avoid re-signing every request.
      const iatMs = Number(payload.iat ?? 0) * 1000;
      if (Date.now() - iatMs > DAY) {
        const fresh = await new SignJWT({ email: payload.email })
          .setProtectedHeader({ alg: "HS256" })
          .setSubject(String(payload.sub))
          .setIssuedAt()
          .setExpirationTime("30d")
          .sign(secret);
        res.cookies.set(COOKIE, fresh, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          path: "/",
          maxAge: 60 * 60 * 24 * 30,
        });
      }
      return res;
    } catch {
      /* invalid/expired — fall through to redirect */
    }
  }
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set("next", req.nextUrl.pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/dashboard/:path*", "/chat/:path*", "/account/:path*", "/journal/:path*", "/tools/:path*", "/appointments/:path*", "/vitals/:path*", "/hospitals/:path*", "/library/:path*", "/report/:path*", "/triage/:path*", "/bump/:path*", "/emergency/:path*", "/wellbeing/:path*"],
};
