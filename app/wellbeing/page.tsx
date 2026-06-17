import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getMotherById } from "@/lib/queries";
import { getSettings } from "@/lib/settings";
import AppHeader from "../_components/AppHeader";
import WellbeingCheck from "../_components/WellbeingCheck";

export const dynamic = "force-dynamic";

export default async function WellbeingPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const mother = await getMotherById(session.sub);
  if (!mother) redirect("/login");

  const settings = await getSettings();
  const features = { journal: settings.journal_enabled, tools: settings.tools_enabled, chat: settings.chat_enabled };

  return (
    <>
      <AppHeader plan={mother.plan} lang={mother.language} active="journal" features={features} />
      <div className="app-shell" style={{ maxWidth: 640 }}>
        <p className="s-label">Your wellbeing</p>
        <h1 className="s-title" style={{ marginBottom: 6 }}>How are you, really?</h1>
        <p className="muted" style={{ marginBottom: 24 }}>
          Pregnancy stirs up a lot of feelings. This private 10-question check helps you and Bumply notice if your mood
          needs some care. Answer for how you&apos;ve felt over the <strong>past 7 days</strong>. Only you see this.
        </p>
        <WellbeingCheck />
      </div>
    </>
  );
}
