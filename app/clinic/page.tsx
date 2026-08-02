import { redirect } from "next/navigation";
import { getClinician } from "@/lib/clinicianSession";
import {
  chwWorklist,
  impactReport,
  listAlerts,
  listMothersForChw,
  outcomeStats,
  reachReport,
  timeToCare,
} from "@/lib/queries";
import ChwWorklist from "../_components/ChwWorklist";
import ClinicAlerts from "../_components/ClinicAlerts";
import ClinicReport from "../_components/ClinicReport";

export const dynamic = "force-dynamic";

export default async function ClinicPage() {
  const clin = await getClinician();
  if (!clin) redirect("/clinic/login");
  const [alerts, myMothers, stats, impact, worklist, ttc, reach] = await Promise.all([
    listAlerts(undefined, 100),
    listMothersForChw(clin.sub),
    outcomeStats(),
    impactReport(),
    chwWorklist(clin.sub),
    timeToCare(),
    reachReport(),
  ]);
  return (
    <>
      <div className="app-shell" style={{ maxWidth: 760, paddingBottom: 0 }}>
        {/* Worklist first: a CHW opens this to find out who to see today, not to
            read the programme's numbers. Evidence comes after the work. */}
        <ChwWorklist rows={worklist} />
        <ClinicReport data={impact} timeToCare={ttc} reach={reach} />
      </div>
      <ClinicAlerts clinicianName={clin.name} alerts={alerts} chwMothers={myMothers} stats={stats} />
    </>
  );
}
