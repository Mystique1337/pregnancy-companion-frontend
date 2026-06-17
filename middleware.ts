import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

const secret = new TextEncoder().encode(process.env.AUTH_SECRET || "dev-insecure-secret-change-me");

export async function middleware(req: NextRequest) {
  const token = req.cookies.get("bumply_session")?.value;
  if (token) {
    try {
      await jwtVerify(token, secret);
      return NextResponse.next();
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
  matcher: ["/dashboard/:path*", "/chat/:path*", "/account/:path*", "/journal/:path*", "/tools/:path*", "/appointments/:path*", "/vitals/:path*", "/hospitals/:path*", "/library/:path*", "/report/:path*"],
};
