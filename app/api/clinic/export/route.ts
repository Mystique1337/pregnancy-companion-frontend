import { getClinician } from "@/lib/clinicianSession";
import { alertsForExport } from "@/lib/queries";

export const dynamic = "force-dynamic";

// Quote every field, double embedded quotes, and neutralise newlines so a stray
// message never breaks the CSV row structure (or lets a value bleed into columns).
function csvCell(v: unknown): string {
  const s = v == null ? "" : String(v);
  const clean = s.replace(/\r\n|\r|\n/g, " ");
  return `"${clean.replace(/"/g, '""')}"`;
}

export async function GET() {
  const clin = await getClinician();
  if (!clin) return new Response("unauthorized", { status: 401 });

  const rows = await alertsForExport(1000);
  const header = [
    "full_name", "phone", "whatsapp_number", "level", "kind", "message",
    "status", "outcome", "created_at", "outcome_at", "outcome_by",
  ];
  const lines = [header.map(csvCell).join(",")];
  for (const r of rows) {
    lines.push([
      r.full_name, r.phone, r.whatsapp_number, r.level, r.kind, r.message,
      r.status, r.outcome, r.created_at, r.outcome_at, r.outcome_by,
    ].map(csvCell).join(","));
  }
  const csv = lines.join("\r\n");

  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="bumply-alerts.csv"',
      "Cache-Control": "no-store",
    },
  });
}
