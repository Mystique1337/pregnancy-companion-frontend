import { redirect } from "next/navigation";
import { getClinician } from "@/lib/clinicianSession";
import { listAlerts, listMothersForChw, outcomeStats } from "@/lib/queries";
import ClinicAlerts from "../_components/ClinicAlerts";

export const dynamic = "force-dynamic";

export default async function ClinicPage() {
  const clin = await getClinician();
  if (!clin) redirect("/clinic/login");
  const [alerts, myMothers, stats] = await Promise.all([
    listAlerts(undefined, 100),
    listMothersForChw(clin.sub),
    outcomeStats(),
  ]);
  return <ClinicAlerts clinicianName={clin.name} alerts={alerts} chwMothers={myMothers} stats={stats} />;
}
