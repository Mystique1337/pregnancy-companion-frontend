import { redirect } from "next/navigation";
import { getClinician } from "@/lib/clinicianSession";
import { impactReport, listAlerts, listMothersForChw, outcomeStats } from "@/lib/queries";
import ClinicAlerts from "../_components/ClinicAlerts";
import ClinicReport from "../_components/ClinicReport";

export const dynamic = "force-dynamic";

export default async function ClinicPage() {
  const clin = await getClinician();
  if (!clin) redirect("/clinic/login");
  const [alerts, myMothers, stats, impact] = await Promise.all([
    listAlerts(undefined, 100),
    listMothersForChw(clin.sub),
    outcomeStats(),
    impactReport(),
  ]);
  return (
    <>
      <div className="app-shell" style={{ maxWidth: 760, paddingBottom: 0 }}>
        <ClinicReport data={impact} />
      </div>
      <ClinicAlerts clinicianName={clin.name} alerts={alerts} chwMothers={myMothers} stats={stats} />
    </>
  );
}
