"use client";
import { normalizeLang } from "@/lib/languages";
import { t } from "@/lib/i18n";

type Features = { journal: boolean; tools: boolean; chat: boolean };

export default function BottomNav({ active, features, lang, plan = "free" }: { active?: string; features: Features; lang?: string | null; plan?: "free" | "premium" }) {
  const L = normalizeLang(lang);
  // "Ask" always leads somewhere useful: premium → full chat, free → the free
  // offline voice helper (so the voice channel is never a dead paywall).
  const askHref = plan === "premium" && features.chat ? "/chat" : "/sos";
  const items = [
    { key: "dashboard", href: "/dashboard", icon: "🏠", label: t("nav.dashboard", L) },
    { key: "chat", href: askHref, icon: "💬", label: t("nav.chat", L) },
    { key: "sos", href: "/sos", icon: "🆘", label: t("nav.sos", L), sos: true },
    { key: "vitals", href: "/vitals", icon: "🩺", label: t("nav.vitals", L) },
    { key: "account", href: "/account", icon: "👤", label: t("nav.account", L) },
  ] as { key: string; href: string; icon: string; label: string; sos?: boolean }[];

  return (
    <nav className="bottom-nav">
      {items.map((it) => (
        <a key={it.key} href={it.href} className={"bn-item" + (it.sos ? " sos" : "") + (active === it.key ? " active" : "")}>
          <span className="bn-icon">{it.icon}</span>
          <span className="bn-label">{it.label}</span>
        </a>
      ))}
    </nav>
  );
}
