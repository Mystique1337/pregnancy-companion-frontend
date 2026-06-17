import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getMotherById, getOrCreateTelegramToken, getOrCreateFamilyToken } from "@/lib/queries";
import { telegramConfigured, telegramBotUsername } from "@/lib/telegram";
import { getSettings } from "@/lib/settings";
import { normalizeLang } from "@/lib/languages";
import { t } from "@/lib/i18n";
import { getPrefs } from "@/lib/personalize";
import AppHeader from "../_components/AppHeader";
import SubscribeButton from "../_components/SubscribeButton";
import PreferencesForm from "../_components/PreferencesForm";
import EmergencyContactForm from "../_components/EmergencyContactForm";
import FamilyInvite from "../_components/FamilyInvite";
import TelegramLink from "../_components/TelegramLink";

export const dynamic = "force-dynamic";

export default async function Account() {
  const session = await getSession();
  if (!session) redirect("/login");
  const mother = await getMotherById(session.sub);
  if (!mother) redirect("/login");

  const settings = await getSettings();
  const features = { journal: settings.journal_enabled, tools: settings.tools_enabled, chat: settings.chat_enabled };
  const L = normalizeLang(mother.language);

  const row = (k: string, v: string) => (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
      <span className="muted">{k}</span>
      <span style={{ fontSize: 14 }}>{v || "—"}</span>
    </div>
  );

  return (
    <>
      <AppHeader plan={mother.plan} lang={mother.language} active="account" features={features} />
      <div className="app-shell" style={{ maxWidth: 640 }}>
        <p className="s-label">{t("account.title", L)}</p>
        <h1 className="s-title" style={{ marginBottom: 12 }}>{t("account.details", L)}</h1>
        <a className="btn-ghost" href="/report" style={{ display: "inline-flex", marginBottom: 20 }}>📄 Report for your doctor</a>

        <div className="card" style={{ marginBottom: 20 }}>
          {row(t("account.name", L), mother.full_name)}
          {row(t("account.email", L), mother.email)}
          {row(t("account.partner", L), mother.partner_name || "")}
          {row(t("account.phone", L), mother.whatsapp_number || mother.phone || "")}
          {row(t("account.curweek", L), `${t("dash.week", L)} ${mother.current_week} · ${mother.trimester} ${t("dash.trimester", L)}`)}
          {row(t("account.duedate", L), mother.due_date ? new Date(mother.due_date).toISOString().slice(0, 10) : "")}
          {row(t("account.firstpreg", L), mother.first_pregnancy ? t("common.yes", L) : t("common.no", L))}
          {row(t("account.dietary", L), mother.dietary_restrictions || t("common.none", L))}
          {row(t("account.ethnicity", L), mother.ethnicity || t("common.none", L))}
        </div>

        <div className="card">
          <p className="s-label">{t("account.plan", L)}</p>
          <h3 className="feat-title" style={{ marginBottom: 4 }}>
            {t("account.youreon", L)}{" "}
            <span className={"badge " + (mother.plan === "premium" ? "badge-premium" : "badge-free")}>{mother.plan}</span>
          </h3>
          <p className="muted" style={{ marginBottom: 16 }}>
            {mother.plan === "premium" ? t("account.premiumDesc", L) : t("account.freeDesc", L)}
          </p>
          {mother.plan === "premium" ? (
            <SubscribeButton plan="free" label={t("account.cancel", L)} href="/account" className="btn-ghost" />
          ) : (
            <SubscribeButton plan="premium" label={t("account.upgrade", L)} href="/account" />
          )}
        </div>

        <PreferencesForm prefs={getPrefs(mother)} lang={mother.language} />

        <EmergencyContactForm name={mother.emergency_contact_name} phone={mother.emergency_contact_phone} />

        <FamilyInvite token={await getOrCreateFamilyToken(mother.id)} firstName={mother.full_name?.split(" ")[0] || ""} />

        {telegramConfigured() && (
          <TelegramLink
            linked={!!mother.telegram_chat_id}
            code={await getOrCreateTelegramToken(mother.id)}
            botUser={telegramBotUsername()}
            lang={mother.language}
          />
        )}
      </div>
    </>
  );
}
