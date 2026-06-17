import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getMotherById } from "@/lib/queries";
import { getSettings } from "@/lib/settings";
import AppHeader from "../_components/AppHeader";
import EmergencyMode from "../_components/EmergencyMode";

export const dynamic = "force-dynamic";

export default async function EmergencyPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const mother = await getMotherById(session.sub);
  if (!mother) redirect("/login");

  const settings = await getSettings();
  const features = { journal: settings.journal_enabled, tools: settings.tools_enabled, chat: settings.chat_enabled };
  const contact = mother.emergency_contact_name || mother.emergency_contact_phone
    ? { name: mother.emergency_contact_name, phone: mother.emergency_contact_phone }
    : null;

  return (
    <>
      <AppHeader plan={mother.plan} lang={mother.language} active="vitals" features={features} />
      <div className="app-shell" style={{ maxWidth: 620 }}>
        <p className="s-label" style={{ color: "#C0392B" }}>Emergency</p>
        <h1 className="s-title" style={{ marginBottom: 6 }}>Get help fast</h1>
        <p className="muted" style={{ marginBottom: 24 }}>
          One tap finds the nearest hospital, lets you alert your loved one with your location, and notifies your clinician.
          For a real emergency, don&apos;t wait — go to a hospital now.
        </p>
        <EmergencyMode contact={contact} />
      </div>
    </>
  );
}
