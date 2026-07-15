import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const secret = new TextEncoder().encode(process.env.AUTH_SECRET || "dev-insecure-secret-change-me");
export const SESSION_COOKIE = "bumply_session";

export type SessionData = { sub: string; email: string };

export async function createSession(data: SessionData) {
  const token = await new SignJWT({ email: data.email })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(data.sub)
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secret);
  const c = await cookies();
  c.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function getSession(): Promise<SessionData | null> {
  const c = await cookies();
  const token = c.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret);
    return { sub: String(payload.sub), email: String(payload.email) };
  } catch {
    return null;
  }
}

export async function destroySession() {
  const c = await cookies();
  c.delete(SESSION_COOKIE);
}

// --- Password reset (stateless, signed token; 1-hour expiry) ---
export async function createResetToken(sub: string, email: string): Promise<string> {
  return new SignJWT({ email, purpose: "reset" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(sub)
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(secret);
}

export async function verifyResetToken(token: string): Promise<SessionData | null> {
  try {
    const { payload } = await jwtVerify(token, secret);
    if (payload.purpose !== "reset") return null;
    return { sub: String(payload.sub), email: String(payload.email) };
  } catch {
    return null;
  }
}
