import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getMotherById, recentChat } from "@/lib/queries";
import { currentWeekFrom, trimesterFor } from "@/lib/babyData";
import { getSettings } from "@/lib/settings";
import { normalizeLang } from "@/lib/languages";
import { t } from "@/lib/i18n";
import AppHeader from "../_components/AppHeader";
import ChatPanel from "../_components/ChatPanel";
import OfflineHelper from "../_components/OfflineHelper";

export const dynamic = "force-dynamic";

const SUGGESTION_KEYS: Record<string, string[]> = {
  first: ["chat.s.first1", "chat.s.first2", "chat.s.first3"],
  second: ["chat.s.second1", "chat.s.second2", "chat.s.second3"],
  third: ["chat.s.third1", "chat.s.third2", "chat.s.third3"],
};

export default async function ChatPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const mother = await getMotherById(session.sub);
  if (!mother) redirect("/login");

  const settings = await getSettings();
  if (!settings.chat_enabled) redirect("/dashboard");
  const features = { journal: settings.journal_enabled, tools: settings.tools_enabled, chat: settings.chat_enabled };

  const week = currentWeekFrom({ dueDate: mother.due_date, enteredWeek: mother.current_week, createdAt: mother.created_at });
  const trimester = trimesterFor(week);
  const L = normalizeLang(mother.language);
  const suggestions = SUGGESTION_KEYS[trimester].map((k) => t(k, L));

  return (
    <>
      <AppHeader plan={mother.plan} lang={mother.language} active="chat" features={features} />
      <div className="app-shell">
        <p className="s-label">{t("chat.talkto", L)}</p>
        <h1 className="s-title" style={{ marginBottom: 12 }}>{t("chat.companionAny", L)}</h1>
        <p className="muted" style={{ marginBottom: 16, fontSize: 14 }}>
          🎤 {t("chat.voiceHint", L)}
        </p>

        {mother.plan === "premium" ? (
          <>
            <ChatPanel
              name={mother.full_name}
              lang={mother.language}
              suggestions={suggestions}
              initial={await loadInitial(mother.id, mother.full_name, week)}
            />
            <p className="muted" style={{ textAlign: "center", marginTop: 12, fontSize: 11 }}>{t("chat.disclaimer", L)}</p>

            {/* Chat is where she comes when she wants to ask something, so it is
                where the no-signal version belongs too. Secondary by default so
                it never competes with the real thing. */}
            <details id="offline" style={{ marginTop: 26 }}>
              <summary style={{ cursor: "pointer", fontSize: 14, fontWeight: 600, padding: "10px 0" }}>
                📶 Ask with no network
              </summary>
              <div style={{ marginTop: 10 }}>
                <OfflineHelper />
              </div>
            </details>
          </>
        ) : (
          <div className="pay-wall">
            <h3 className="feat-title">{t("chat.gateTitle", L)}</h3>
            <p className="muted" style={{ marginBottom: 16 }}>{t("chat.gateDesc", L)}</p>
            <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
              <a className="btn-pink" href="/pricing">{t("dash.seeplans", L)}</a>
              {/* Never a dead end: free users still get the offline voice helper. */}
              <a className="btn-ghost" href="/sos">🎤 {t("chat.freeVoice", L)}</a>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

async function loadInitial(motherId: string, name: string, week: number) {
  const history = await recentChat(motherId, 30);
  if (history.length > 0) {
    return history.map((h) => ({ role: h.role as "user" | "assistant", content: h.content }));
  }
  return [
    {
      role: "assistant" as const,
      content: `Hi ${name}, I'm Bumply 🌸 — your pregnancy companion, here any time day or night. You're in week ${week}.\n\nTell me what you need most right now: answers about symptoms, what to eat, clinic-visit reminders — or just how you're really feeling. You can type, or tap the 🎤 and talk to me.`,
    },
  ];
}
