import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getMotherById } from "@/lib/queries";
import { getSettings } from "@/lib/settings";
import AppHeader from "../_components/AppHeader";
import TriageFlow from "../_components/TriageFlow";

export const dynamic = "force-dynamic";

export default async function TriagePage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const mother = await getMotherById(session.sub);
  if (!mother) redirect("/login");

  const settings = await getSettings();
  const features = { journal: settings.journal_enabled, tools: settings.tools_enabled, chat: settings.chat_enabled };

  return (
    <>
      <AppHeader plan={mother.plan} lang={mother.language} active="vitals" features={features} />
      <div className="app-shell" style={{ maxWidth: 720 }}>
        <p className="s-label">Health</p>
        <h1 className="s-title" style={{ marginBottom: 6 }}>Symptom check</h1>
        <p className="muted" style={{ marginBottom: 8 }}>
          A quick guide to whether something needs urgent care, a call to your clinic, or just a little self-care.
          It never replaces your provider — when in doubt, reach out.
        </p>
        <div className="card" style={{ background: "var(--pink-pale)", border: "1px solid var(--pink)", padding: "12px 16px", marginBottom: 24 }}>
          <p style={{ fontSize: 13, color: "var(--ink-mid)" }}>
            🚨 If you feel something is seriously wrong — heavy bleeding, fits, severe pain, your baby not moving — don&apos;t wait for this tool. Go to a hospital now.
          </p>
        </div>
        <TriageFlow />
      </div>
    </>
  );
}
