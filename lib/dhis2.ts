// ============================================================================
// DHIS2 interoperability — Bumply → the national HMIS.
//
// WHY: Nigeria's health system reports through DHIS2 (NHMIS). A maternal-health
// tool that cannot hand its numbers to DHIS2 is a parallel data silo, and a state
// ministry will treat it as one. This module turns our aggregate counts into the
// exact payload DHIS2's `/api/dataValueSets` endpoint accepts.
//
// DELIBERATELY EXPORT-ONLY — no network calls. The first honest step is producing
// a file a DHIS2 admin can import (or eyeball) themselves. Pushing over the wire
// needs real credentials, a real orgUnit hierarchy and real dataElement UIDs from
// the destination instance; until those exist, an automated push would just be
// writing to a URL that isn't there.
//
// Pure functions, no I/O, no env reads.
// ============================================================================

// Type-only import: erased at compile time, so this module pulls in no database
// connection (lib/queries.ts opens one at import).
import type { Hmis } from "@/lib/queries";

/** The Bumply metrics we report. Kept in lockstep with `Hmis` by the compiler. */
export type HmisMetric = keyof Hmis;

export type Dhis2Element = {
  /** DHIS2 dataElement UID: 11 chars, starts with a letter. PLACEHOLDER — see TODO below. */
  readonly uid: string;
  /** Human label, so whoever swaps in the real UID knows what they are mapping. */
  readonly label: string;
  /** The NHMIS/DHIS2 concept this should be pointed at in the destination instance. */
  readonly nationalEquivalent: string;
};

/**
 * TODO: REPLACE EVERY `uid` BELOW WITH THE DESTINATION INSTANCE'S REAL UIDs.
 *
 * These are syntactically valid DHIS2 UIDs (11 alphanumeric chars, leading letter)
 * but they are placeholders and will be rejected by any real DHIS2 server. Get the
 * real ones from the instance:  GET /api/dataElements?fields=id,name&paging=false
 * They are per-instance — a UID from a demo server will not work in a state's NHMIS.
 */
export const DHIS2_ELEMENTS: Readonly<Record<HmisMetric, Dhis2Element>> = {
  mothersEnrolled: {
    uid: "BUMPLYenr01",
    label: "Mothers enrolled (Bumply)",
    nationalEquivalent: "ANC registrations / new ANC clients in the reporting period",
  },
  ancReminders: {
    uid: "BUMPLYanc02",
    label: "ANC visit reminders sent",
    nationalEquivalent: "No direct NHMIS element — usually a programme-indicator or custom element for demand-generation contacts",
  },
  dangerSignsDetected: {
    uid: "BUMPLYdgr03",
    label: "Danger signs detected",
    nationalEquivalent: "Obstetric danger signs identified at community level (CHW/ICCM reporting)",
  },
  referralsIssued: {
    uid: "BUMPLYref04",
    label: "Referrals issued to a facility",
    nationalEquivalent: "Clients referred from community to facility",
  },
  arrivalsConfirmed: {
    uid: "BUMPLYarr05",
    label: "Referral arrivals confirmed at facility",
    nationalEquivalent: "Referrals completed / counter-referral confirmed — the closed-loop half of the referral element",
  },
  deliveries: {
    uid: "BUMPLYdel06",
    label: "Deliveries reported",
    nationalEquivalent: "Total deliveries / births reported in the period",
  },
  immunisationReminders: {
    uid: "BUMPLYimm07",
    label: "Immunisation reminders sent",
    nationalEquivalent: "No direct NHMIS element — custom element for immunisation demand-generation contacts",
  },
};

/**
 * Fixed emission order. DHIS2 does not care, but a stable order makes exports
 * diffable and CSV fixtures reviewable.
 */
const METRIC_ORDER: readonly HmisMetric[] = [
  "mothersEnrolled",
  "ancReminders",
  "dangerSignsDetected",
  "referralsIssued",
  "arrivalsConfirmed",
  "deliveries",
  "immunisationReminders",
];

/** One `dataValues[]` entry. DHIS2 takes `value` as a string, even for counts. */
export type DataValue = { dataElement: string; value: string };

/** The `/api/dataValueSets` payload shape, verbatim. */
export type DataValueSet = {
  dataSet?: string;
  completeDate?: string;
  period: string;
  orgUnit: string;
  dataValues: DataValue[];
};

const MS_PER_DAY = 86_400_000;
const MONTHLY_RE = /^(\d{4})(\d{2})$/;
// DHIS2 writes weekly periods unpadded (2026W7) but pads are common in the wild;
// accept both rather than 400 on a difference that carries no meaning.
const WEEKLY_RE = /^(\d{4})W(\d{1,2})$/;

export const PERIOD_FORMAT_HELP =
  'period must be DHIS2 format: "YYYYMM" for a month (e.g. 202607) or "YYYYWnn" for an ISO week (e.g. 2026W27)';

/** `YYYY-MM-DD` in UTC — DHIS2's date format for `completeDate`. */
function isoDate(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/**
 * Parse a DHIS2 period into a half-open ISO range [since, until).
 *
 * Half-open on purpose: it matches how `hmisAggregate` filters
 * (`created_at >= since and created_at < until`), so no record is double-counted
 * at a period boundary and none falls through the gap between two periods.
 *
 * Throws with an actionable message — a silent fallback to "this month" would
 * make a bad export look like a good one.
 */
export function periodToRange(period: string): { sinceIso: string; untilIso: string } {
  const p = period.trim();

  const monthly = MONTHLY_RE.exec(p);
  if (monthly) {
    const year = Number(monthly[1]);
    const month = Number(monthly[2]);
    if (month < 1 || month > 12) throw new Error(`Invalid period "${period}": month must be 01-12. ${PERIOD_FORMAT_HELP}`);
    if (year < 2000 || year > 2100) throw new Error(`Invalid period "${period}": year ${year} is out of range (2000-2100).`);
    const since = Date.UTC(year, month - 1, 1);
    // Month 12 rolls to (year+1, month 0) — Date.UTC normalises it for us.
    const until = Date.UTC(year, month, 1);
    return { sinceIso: new Date(since).toISOString(), untilIso: new Date(until).toISOString() };
  }

  const weekly = WEEKLY_RE.exec(p);
  if (weekly) {
    const year = Number(weekly[1]);
    const week = Number(weekly[2]);
    if (week < 1 || week > 53) throw new Error(`Invalid period "${period}": week must be 1-53. ${PERIOD_FORMAT_HELP}`);
    if (year < 2000 || year > 2100) throw new Error(`Invalid period "${period}": year ${year} is out of range (2000-2100).`);

    // ISO-8601 weeks (DHIS2's default "Weekly" type): weeks start Monday and week 1
    // is the week containing 4 January.
    const jan4 = Date.UTC(year, 0, 4);
    const jan4Dow = (new Date(jan4).getUTCDay() + 6) % 7; // Mon=0 … Sun=6
    const week1Monday = jan4 - jan4Dow * MS_PER_DAY;
    const since = week1Monday + (week - 1) * 7 * MS_PER_DAY;

    // Only some years have a week 53. The ISO test: the week's Thursday must fall
    // inside the stated year. Cheaper and more reliable than a leap-year table.
    const thursday = new Date(since + 3 * MS_PER_DAY);
    if (thursday.getUTCFullYear() !== year) {
      throw new Error(`Invalid period "${period}": ${year} has no ISO week ${week}.`);
    }
    return { sinceIso: new Date(since).toISOString(), untilIso: new Date(since + 7 * MS_PER_DAY).toISOString() };
  }

  throw new Error(`Invalid period "${period}". ${PERIOD_FORMAT_HELP}`);
}

/** The DHIS2 monthly period for a given instant (defaults to now), e.g. "202608". */
export function currentPeriod(now: Date = new Date()): string {
  return `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

export type ToDataValueSetOptions = {
  period: string;
  orgUnit: string;
  dataSet?: string;
  /**
   * `YYYY-MM-DD`. Optional so this function stays pure and testable; defaults to
   * today (UTC). DHIS2 reads it as "the period was marked complete on this date".
   */
  completeDate?: string;
};

/**
 * Build the exact `/api/dataValueSets` payload. Import it with:
 *   POST /api/dataValueSets  (Content-Type: application/json)
 */
export function toDataValueSet(hmis: Hmis, opts: ToDataValueSetOptions): DataValueSet {
  // Validate here too: a malformed period would otherwise be silently accepted by
  // this function and only rejected later, by DHIS2, with a far worse message.
  periodToRange(opts.period);
  const orgUnit = opts.orgUnit.trim();
  if (!orgUnit) throw new Error("orgUnit is required (the DHIS2 UID of the reporting facility or district).");

  // Key order mirrors the shape in the DHIS2 docs — these payloads get read by
  // humans before they ever get POSTed.
  return {
    ...(opts.dataSet ? { dataSet: opts.dataSet.trim() } : {}),
    completeDate: opts.completeDate ?? isoDate(Date.now()),
    period: opts.period.trim(),
    orgUnit,
    dataValues: METRIC_ORDER.map((metric) => ({
      dataElement: DHIS2_ELEMENTS[metric].uid,
      value: String(hmis[metric] ?? 0),
    })),
  };
}

/**
 * Quote every field and neutralise newlines so no value can break the row
 * structure. Same defensive shape as app/api/clinic/export/route.ts.
 */
function csvCell(v: unknown): string {
  const s = v == null ? "" : String(v);
  return `"${s.replace(/\r\n|\r|\n/g, " ").replace(/"/g, '""')}"`;
}

/**
 * DHIS2's CSV import variant of the same data.
 *
 * DHIS2's full CSV template also carries categoryoptioncombo, attributeoptioncombo,
 * storedby, lastupdated, comment and followup. We omit them: we report no
 * disaggregation, and DHIS2 falls back to the default category option combo when
 * those columns are absent. Adding empty columns would imply a disaggregation we
 * do not actually have.
 */
export function toCsv(dvs: DataValueSet): string {
  const rows = [["dataelement", "period", "orgunit", "value"].join(",")];
  for (const dv of dvs.dataValues) {
    rows.push([dv.dataElement, dvs.period, dvs.orgUnit, dv.value].map(csvCell).join(","));
  }
  return rows.join("\r\n") + "\r\n";
}
