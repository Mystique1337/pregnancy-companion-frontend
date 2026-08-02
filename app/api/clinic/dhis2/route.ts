import { NextResponse } from "next/server";
import { getClinician } from "@/lib/clinicianSession";
import { hmisAggregate, logAudit } from "@/lib/queries";
import { PERIOD_FORMAT_HELP, currentPeriod, periodToRange, toCsv, toDataValueSet } from "@/lib/dhis2";

export const dynamic = "force-dynamic";

/**
 * GET /api/clinic/dhis2 — national HMIS export.
 *
 * Hands the period's aggregate counts to whoever runs the DHIS2 instance, in the
 * shape DHIS2 already understands, so Bumply reports into NHMIS instead of beside it.
 *
 *   ?period=202607   DHIS2 period (default: the current month). YYYYMM or YYYYWnn.
 *   ?orgUnit=abc     DHIS2 orgUnit UID (default: $DHIS2_ORG_UNIT, else BUMPLY_PILOT)
 *   ?dataSet=xyz     optional DHIS2 dataSet UID
 *   ?format=json|csv json → POST to /api/dataValueSets; csv → downloadable import file
 *
 * Aggregate counts only — no mother is identifiable in this payload.
 */
export async function GET(req: Request) {
  const clin = await getClinician();
  if (!clin) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const params = new URL(req.url).searchParams;
  const period = (params.get("period") || currentPeriod()).trim();
  const orgUnit = (params.get("orgUnit") ?? process.env.DHIS2_ORG_UNIT ?? "BUMPLY_PILOT").trim();
  const format = (params.get("format") || "json").trim().toLowerCase();
  const dataSet = params.get("dataSet")?.trim() || undefined;

  if (format !== "json" && format !== "csv") {
    return NextResponse.json({ error: `Invalid format "${format}". Use format=json or format=csv.` }, { status: 400 });
  }
  if (!orgUnit) {
    return NextResponse.json(
      { error: "orgUnit is required — pass ?orgUnit=<DHIS2 orgUnit UID> or set DHIS2_ORG_UNIT." },
      { status: 400 },
    );
  }

  // Validate the period BEFORE touching the database: a bad period should cost a
  // 400 and a clear message, not a query over a nonsense date range.
  let range: { sinceIso: string; untilIso: string };
  try {
    range = periodToRange(period);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : `Invalid period "${period}". ${PERIOD_FORMAT_HELP}`, example: "202607" },
      { status: 400 },
    );
  }

  const hmis = await hmisAggregate(range.sinceIso, range.untilIso);
  const dvs = toDataValueSet(hmis, { period, orgUnit, dataSet });

  // Reporting to a national system is a governance event: who exported what, when.
  // Fire-and-forget by design — it must never block or fail the export.
  logAudit({
    actor: "chw",
    action: "dhis2_export",
    channel: "api",
    summary: `DHIS2 ${format} export · period ${period} · orgUnit ${orgUnit}`,
    meta: { period, orgUnit, format, dataSet: dataSet ?? null, by: clin.email, range, values: hmis },
  });

  if (format === "csv") {
    return new Response(toCsv(dvs), {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="bumply-${period}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  }

  return NextResponse.json(dvs, { headers: { "Cache-Control": "no-store" } });
}
