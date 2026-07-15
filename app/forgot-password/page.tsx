"use client";
import { useState } from "react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit() {
    if (!email.trim()) return;
    setBusy(true);
    await fetch("/api/auth/forgot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    }).catch(() => {});
    setBusy(false);
    setSent(true);
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <a href="/login" style={{ color: "var(--ink-muted)", fontSize: 13, marginBottom: 14, display: "inline-block" }}>← Back to sign in</a>
        <a className="logo" href="/" style={{ marginBottom: 24 }}>
          <div className="logo-dot" />
          Bumply
        </a>
        {sent ? (
          <>
            <h3 className="fc-head">Check your inbox 🌸</h3>
            <p className="fc-sub">If an account exists for <strong>{email}</strong>, we&apos;ve sent a link to reset your password. It works for the next hour.</p>
            <a className="f-submit" href="/login" style={{ display: "inline-flex", justifyContent: "center", textDecoration: "none", marginTop: 8 }}>Back to sign in</a>
          </>
        ) : (
          <>
            <h3 className="fc-head">Reset your password</h3>
            <p className="fc-sub">Enter your email and we&apos;ll send you a link to set a new one.</p>
            <div className="fg">
              <label>Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="amara@email.com" onKeyDown={(e) => e.key === "Enter" && submit()} />
            </div>
            <button className="f-submit" onClick={submit} disabled={busy}>{busy ? "Sending…" : "Send reset link"}</button>
          </>
        )}
      </div>
    </div>
  );
}
