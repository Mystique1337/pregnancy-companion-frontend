import { existsSync } from "node:fs";
import { join } from "node:path";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getMotherById, listWeeklyUpdates, getWeeklyUpdateByWeek, updateMotherWeek } from "@/lib/queries";
import { currentWeekFrom, getBabyData, babySizeText, trimesterFor, progressPct } from "@/lib/babyData";
import { babyImageFor } from "@/lib/babyImages";
import { getSettings } from "@/lib/settings";
import { normalizeLang } from "@/lib/languages";
import { t } from "@/lib/i18n";
import { telegramConfigured, telegramBotUsername } from "@/lib/telegram";
import AppHeader from "../_components/AppHeader";
import WeekExtras from "../_components/WeekExtras";
import EnableNotifications from "../_components/EnableNotifications";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const session = await getSession();
  if (!session) redirect("/login");
  const mother = await getMotherById(session.sub);
  if (!mother) redirect("/login");

  // Live week — advances automatically with time.
  const week = currentWeekFrom({ dueDate: mother.due_date, enteredWeek: mother.current_week, createdAt: mother.created_at });
  const trimester = trimesterFor(week);
  if (week !== mother.current_week) await updateMotherWeek(mother.id, week, trimester);

  const baby = getBabyData(week);
  const babyImg = babyImageFor(week);
  const current = await getWeeklyUpdateByWeek(mother.id, week);
  const all = await listWeeklyUpdates(mother.id);
  const premium = mother.plan === "premium";
  const weeksLeft = Math.max(0, 40 - week);
  const settings = await getSettings();
  const features = { journal: settings.journal_enabled, tools: settings.tools_enabled, chat: settings.chat_enabled };
  const L = normalizeLang(mother.language);
  // Shareable "Week N" recap video (pre-rendered via `npm run remotion:render`).
  const shareVideo = existsSync(join(process.cwd(), "public", "share", `week-${week}.mp4`)) ? `/share/week-${week}.mp4` : null;

  return (
    <>
      <AppHeader plan={mother.plan} lang={mother.language} active="dashboard" features={features} />
      <div className="app-shell">
        <p className="s-label">{t("dash.journey", L)}</p>
        <h1 className="s-title" style={{ marginBottom: 6 }}>
          {t("dash.hello", L)}, <em>{mother.full_name}</em>
        </h1>
        <p className="muted" style={{ marginBottom: 24 }}>
          {t("dash.youarein", L)} <strong>{t("dash.week", L)} {week}</strong> · {trimester} {t("dash.trimester", L)} ·{" "}
          {weeksLeft === 0 ? t("dash.anyday", L) : `${weeksLeft} ${t("dash.weekstogo", L)}`}
        </p>

        <EnableNotifications />

        {/* Progress bar */}
        <div style={{ height: 8, background: "var(--lav-pale)", borderRadius: 100, overflow: "hidden", marginBottom: 28 }}>
          <div style={{ width: `${progressPct(week)}%`, height: "100%", background: "linear-gradient(90deg,var(--pink),var(--lavender))" }} />
        </div>

        {/* Authoritative baby hero — instant, never waits on AI */}
        <div className="card" style={{ marginBottom: 20 }}>
          <p className="s-label">{t("dash.thisweek", L)}</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={babyImg.src}
            alt={`Your baby's development around week ${week}`}
            width={180}
            height={180}
            style={{
              width: 180,
              height: 180,
              objectFit: "cover",
              borderRadius: "50%",
              display: "block",
              margin: "4px auto 6px",
              border: "5px solid #fff",
              boxShadow: "0 8px 28px rgba(201,123,90,.28)",
            }}
          />
          <p className="muted" style={{ textAlign: "center", marginBottom: 12, fontSize: 13 }}>{babyImg.stage}</p>
          <h2 className="feat-title" style={{ fontSize: 26, textAlign: "center" }}>
            {t("dash.yourbabyis", L)} {baby ? `${babySizeText(week)}` : "🌱"}
          </h2>
          {baby && (
            <div className="grid-2" style={{ marginTop: 14 }}>
              <div className="card" style={{ background: "var(--pink-pale)", border: "none" }}>
                <p className="s-label">{t("dash.length", L)}</p>
                <p style={{ fontFamily: "var(--serif)", fontSize: 28 }}>{baby.lengthCm} cm</p>
              </div>
              <div className="card" style={{ background: "var(--lav-pale)", border: "none" }}>
                <p className="s-label">{t("dash.weight", L)}</p>
                <p style={{ fontFamily: "var(--serif)", fontSize: 28 }}>
                  {baby.weightG >= 1000 ? `${(baby.weightG / 1000).toFixed(2)} kg` : baby.weightG > 0 ? `${baby.weightG} g` : "a few mg"}
                </p>
              </div>
            </div>
          )}
          <p className="muted" style={{ marginTop: 14 }}>
            {current?.baby_development || (baby ? `This week, ${baby.development}.` : "Take it gently — these early weeks matter.")}
          </p>
          {shareVideo && (
            <a className="btn-ghost" href={shareVideo} download style={{ marginTop: 14, display: "inline-flex" }}>
              📲 Download your week {week} video to share
            </a>
          )}
        </div>

        {/* AI extras: affirmation + premium content, or the "writing…" state */}
        {current ? (
          <div className="card" style={{ marginBottom: 28 }}>
            {current.affirmation && (
              <p style={{ fontFamily: "var(--serif)", fontStyle: "italic", fontSize: 22, color: "var(--ink-mid)", marginBottom: 18 }}>
                “{current.affirmation}”
              </p>
            )}
            {premium ? (
              <div className="grid-2">
                <a className="btn-pink" href={`/my-update/${current.slug}`}>{t("dash.openfull", L)}</a>
                <a className="btn-ghost" href="/chat">{t("dash.askabout", L)}</a>
              </div>
            ) : (
              <div className="pay-wall">
                <h3 className="feat-title">{t("dash.unlock", L)}</h3>
                <p className="muted" style={{ marginBottom: 16 }}>{t("dash.unlockDesc", L)}</p>
                <a className="btn-pink" href="/pricing">{t("dash.seeplans", L)}</a>
              </div>
            )}
          </div>
        ) : (
          <div style={{ marginBottom: 28 }}>
            <WeekExtras />
          </div>
        )}

        {/* Quick actions */}
        {(features.journal || features.tools) && (
          <div className="grid-2" style={{ marginBottom: 28 }}>
            {features.journal && (
              <a className="card" href="/journal" style={{ display: "block" }}>
                <div style={{ fontSize: 24, marginBottom: 6 }}>📔</div>
                <p style={{ fontFamily: "var(--serif)", fontSize: 18 }}>{t("dash.feeling", L)}</p>
                <p className="muted">{t("dash.feelingDesc", L)}</p>
              </a>
            )}
            {features.tools && (
              <a className="card" href="/tools" style={{ display: "block" }}>
                <div style={{ fontSize: 24, marginBottom: 6 }}>👣</div>
                <p style={{ fontFamily: "var(--serif)", fontSize: 18 }}>{t("dash.pregtools", L)}</p>
                <p className="muted">{t("dash.pregtoolsDesc", L)}</p>
              </a>
            )}
            <a className="card" href="/appointments" style={{ display: "block" }}>
              <div style={{ fontSize: 24, marginBottom: 6 }}>🗓️</div>
              <p style={{ fontFamily: "var(--serif)", fontSize: 18 }}>{t("dash.appointments", L)}</p>
              <p className="muted">{t("dash.apptDesc", L)}</p>
            </a>
            <a className="card" href="/vitals" style={{ display: "block" }}>
              <div style={{ fontSize: 24, marginBottom: 6 }}>🩺</div>
              <p style={{ fontFamily: "var(--serif)", fontSize: 18 }}>{t("nav.vitals", L)}</p>
              <p className="muted">{t("dash.vitalsDesc", L)}</p>
            </a>
            <a className="card" href="/hospitals" style={{ display: "block" }}>
              <div style={{ fontSize: 24, marginBottom: 6 }}>🏥</div>
              <p style={{ fontFamily: "var(--serif)", fontSize: 18 }}>{t("nav.hospitals", L)}</p>
              <p className="muted">{t("dash.hospitalsDesc", L)}</p>
            </a>
            <a className="card" href="/triage" style={{ display: "block" }}>
              <div style={{ fontSize: 24, marginBottom: 6 }}>🩺</div>
              <p style={{ fontFamily: "var(--serif)", fontSize: 18 }}>Symptom check</p>
              <p className="muted">Not sure if something&apos;s serious? Get quick guidance.</p>
            </a>
            <a className="card" href="/emergency" style={{ display: "block", borderColor: "#E0563F", background: "#FDEEEA" }}>
              <div style={{ fontSize: 24, marginBottom: 6 }}>🚨</div>
              <p style={{ fontFamily: "var(--serif)", fontSize: 18, color: "#C0392B" }}>Emergency help</p>
              <p className="muted">Nearest hospital, alert your people, notify your clinician.</p>
            </a>
            <a className="card" href="/sos" style={{ display: "block" }}>
              <div style={{ fontSize: 24, marginBottom: 6 }}>📴</div>
              <p style={{ fontFamily: "var(--serif)", fontSize: 18 }}>Am I okay? (works offline)</p>
              <p className="muted">Danger-sign check + ANC visits — even with no network.</p>
            </a>
            <a className="card" href="/bump" style={{ display: "block" }}>
              <div style={{ fontSize: 24, marginBottom: 6 }}>📸</div>
              <p style={{ fontFamily: "var(--serif)", fontSize: 18 }}>Bump diary</p>
              <p className="muted">Capture your growing bump week by week.</p>
            </a>
            <a className="card" href="/wellbeing" style={{ display: "block" }}>
              <div style={{ fontSize: 24, marginBottom: 6 }}>💛</div>
              <p style={{ fontFamily: "var(--serif)", fontSize: 18 }}>Wellbeing check</p>
              <p className="muted">A private mood check-in — how are you, really?</p>
            </a>
            {telegramConfigured() && (
              <a
                className="card"
                href={mother.telegram_chat_id ? `https://t.me/${telegramBotUsername()}` : "/account"}
                target={mother.telegram_chat_id ? "_blank" : undefined}
                rel="noreferrer"
                style={{ display: "block" }}
              >
                <div style={{ fontSize: 24, marginBottom: 6 }}>✈️</div>
                <p style={{ fontFamily: "var(--serif)", fontSize: 18 }}>{mother.telegram_chat_id ? t("dash.tgChat", L) : t("dash.tgConnect", L)}</p>
                <p className="muted">{mother.telegram_chat_id ? t("dash.tgChatDesc", L) : t("dash.tgConnectDesc", L)}</p>
              </a>
            )}
          </div>
        )}

        {/* History */}
        <p className="s-label">{t("dash.yourweeks", L)}</p>
        <h3 className="feat-title" style={{ marginBottom: 16 }}>{t("dash.everyupdate", L)}</h3>
        {all.length === 0 ? (
          <p className="muted">{t("dash.collecthere", L)}</p>
        ) : (
          <div className="grid-2">
            {all.map((u) => (
              <a key={u.id} className="card" href={premium ? `/my-update/${u.slug}` : "/pricing"} style={{ display: "block" }}>
                <p className="s-label">Week {u.week_number}</p>
                <p style={{ fontFamily: "var(--serif)", fontSize: 18, margin: "4px 0" }}>{u.subject || `Week ${u.week_number}`}</p>
                <p className="muted">{u.baby_size}</p>
              </a>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
