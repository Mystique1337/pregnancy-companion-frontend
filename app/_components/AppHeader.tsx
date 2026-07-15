"use client";

import { useEffect } from "react";
import { normalizeLang } from "@/lib/languages";
import { t } from "@/lib/i18n";
import LanguageSwitcher from "./LanguageSwitcher";
import BottomNav from "./BottomNav";

type Features = { journal: boolean; tools: boolean; chat: boolean };

export default function AppHeader({
  plan,
  active,
  features = { journal: true, tools: true, chat: true },
  lang,
}: {
  plan: "free" | "premium";
  active?: string;
  features?: Features;
  lang?: string | null;
}) {
  const L = normalizeLang(lang);

  // Pre-warm the voice models once per session when the app opens (they scale to
  // zero after ~5 min idle, so this makes the first voice use fast).
  useEffect(() => {
    try {
      if (sessionStorage.getItem("bumply_warmed")) return;
      sessionStorage.setItem("bumply_warmed", "1");
    } catch { /* ignore */ }
    fetch("/api/voice/warm", { method: "POST" }).catch(() => {});
  }, []);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/";
  }

  const link = (href: string, label: string, key: string) => (
    <a href={href} style={active === key ? { color: "var(--pink)" } : undefined}>
      {label}
    </a>
  );

  return (
    <div className="app-bar">
      <div className="app-bar-inner">
        <a className="logo" href="/dashboard">
          <div className="logo-dot" />
          Bumply
        </a>
        <div className="app-nav">
          <span className="app-nav-links">
            {link("/dashboard", t("nav.dashboard", L), "dashboard")}
            {features.journal && link("/journal", t("nav.journal", L), "journal")}
            {features.tools && link("/tools", t("nav.tools", L), "tools")}
            {features.chat && link("/chat", t("nav.chat", L), "chat")}
            {link("/vitals", t("nav.vitals", L), "vitals")}
            {link("/hospitals", t("nav.hospitals", L), "hospitals")}
            {link("/library", t("nav.library", L), "library")}
            {link("/account", t("nav.account", L), "account")}
          </span>
          <span className={"badge " + (plan === "premium" ? "badge-premium" : "badge-free")}>{plan}</span>
          <LanguageSwitcher lang={L} compact />
          <button className="btn-ghost" onClick={logout} style={{ textTransform: "uppercase", fontSize: 12 }}>
            {t("nav.signout", L)}
          </button>
        </div>
      </div>
      <BottomNav active={active} features={features} lang={L} plan={plan} />
    </div>
  );
}
