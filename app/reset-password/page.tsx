"use client";
import { useEffect, useState } from "react";

export default function ResetPasswordPage() {
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setToken(new URLSearchParams(window.location.search).get("token") || "");
  }, []);

  async function submit() {
    setError("");
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
    if (password !== confirm) { setError("Passwords don't match."); return; }
    setBusy(true);
    const res = await fetch("/api/auth/reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { setBusy(false); setError(data.error || "Could not reset your password."); return; }
    window.location.href = "/dashboard"; // reset also signs her in
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <a className="logo" href="/" style={{ marginBottom: 24 }}>
          <div className="logo-dot" />
          Bumply
        </a>
        <h3 className="fc-head">Set a new password</h3>
        <p className="fc-sub">Choose a new password for your Bumply account.</p>
        <div className="fg">
          <label>New password</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
        </div>
        <div className="fg">
          <label>Confirm password</label>
          <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="••••••••" onKeyDown={(e) => e.key === "Enter" && submit()} />
        </div>
        <button className="f-submit" onClick={submit} disabled={busy || !token}>{busy ? "Saving…" : "Save new password"}</button>
        {!token && <p className="f-error">Missing reset link — open the link from your email.</p>}
        {error && <p className="f-error">{error}</p>}
      </div>
    </div>
  );
}
