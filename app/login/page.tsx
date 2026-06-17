"use client";
import { useEffect, useState } from "react";
import { normalizeLang, type LangCode } from "@/lib/languages";
import { t } from "@/lib/i18n";

function clientLang(): string {
  if (typeof document === "undefined") return "en";
  const m = document.cookie.match(/(?:^|; )bumply_lang=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : "en";
}

export default function LoginPage() {
  // Start at "en" to match server HTML, then switch after mount (no hydration mismatch).
  const [L, setL] = useState<LangCode>("en");
  useEffect(() => setL(normalizeLang(clientLang())), []);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    setError("");
    setBusy(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Sign in failed");
      const next = new URLSearchParams(window.location.search).get("next") || "/dashboard";
      window.location.href = next;
    } catch (e) {
      setBusy(false);
      setError(e instanceof Error ? e.message : "Something went wrong.");
    }
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <a href="/" style={{ color: "var(--ink-muted)", fontSize: 13, marginBottom: 14, display: "inline-block" }}>← Back to home</a>
        <a className="logo" href="/" style={{ marginBottom: 24 }}>
          <div className="logo-dot" />
          Bumply
        </a>
        <h3 className="fc-head">{t("login.welcome", L)}</h3>
        <p className="fc-sub">{t("login.sub", L)}</p>
        <div className="fg">
          <label>{t("common.email", L)}</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="amara@email.com"
            onKeyDown={(e) => e.key === "Enter" && submit()} />
        </div>
        <div className="fg">
          <label>{t("common.password", L)}</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••"
            onKeyDown={(e) => e.key === "Enter" && submit()} />
        </div>
        <button className="f-submit" onClick={submit} disabled={busy}>
          {busy ? t("login.signingin", L) : t("login.signin", L)}
        </button>
        {error && <p className="f-error">{error}</p>}
        <p className="f-note" style={{ marginTop: 18 }}>
          {t("login.newhere", L)} <a className="auth-link" href="/#register">{t("login.create", L)}</a>
        </p>
      </div>
    </div>
  );
}
