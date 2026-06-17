import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getMotherById } from "@/lib/queries";
import { getSettings } from "@/lib/settings";
import { currentWeekFrom } from "@/lib/babyData";
import AppHeader from "../_components/AppHeader";
import BumpDiary from "../_components/BumpDiary";

export const dynamic = "force-dynamic";

export default async function BumpPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const mother = await getMotherById(session.sub);
  if (!mother) redirect("/login");

  const settings = await getSettings();
  const features = { journal: settings.journal_enabled, tools: settings.tools_enabled, chat: settings.chat_enabled };
  const week = currentWeekFrom({ dueDate: mother.due_date, enteredWeek: mother.current_week, createdAt: mother.created_at });

  return (
    <>
      <AppHeader plan={mother.plan} lang={mother.language} active="dashboard" features={features} />
      <div className="app-shell" style={{ maxWidth: 720 }}>
        <p className="s-label">Memories</p>
        <h1 className="s-title" style={{ marginBottom: 6 }}>Bump diary</h1>
        <p className="muted" style={{ marginBottom: 24 }}>
          A private, week-by-week photo timeline of your growing bump. Only you can see these — they&apos;re yours to keep.
        </p>
        <BumpDiary defaultWeek={week} />
      </div>
    </>
  );
}
