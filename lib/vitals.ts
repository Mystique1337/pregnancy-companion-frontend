// Vital kinds + red-flag evaluation. Thresholds are conservative, information-only,
// and ALWAYS point the mother to her provider — never a diagnosis.
export type VitalKind = "bp" | "weight" | "temp" | "fhr" | "glucose";

export const VITAL_KINDS: {
  kind: VitalKind;
  label: string;
  unit: string;
  dual?: boolean;
  fields?: [string, string];
  emoji: string;
  hint?: string;
  normal?: string;
}[] = [
  { kind: "bp", label: "Blood pressure", unit: "mmHg", dual: true, fields: ["Systolic", "Diastolic"], emoji: "🩸", hint: "e.g. 120 / 80", normal: "below 120/80" },
  { kind: "weight", label: "Weight", unit: "kg", emoji: "⚖️" },
  { kind: "temp", label: "Temperature", unit: "°C", emoji: "🌡️", normal: "36.5–37.5 °C" },
  { kind: "fhr", label: "Baby's heartbeat", unit: "bpm", emoji: "💓", hint: "from a doppler / scan", normal: "110–160 bpm" },
  { kind: "glucose", label: "Blood sugar", unit: "mmol/L", emoji: "🍬", normal: "below 7.8 after meals" },
];

export function vitalMeta(kind: string) {
  return VITAL_KINDS.find((v) => v.kind === kind);
}

// Humanly-plausible bounds per kind. Anything outside is a typo/entry error —
// reject it instead of storing it and firing a false "go to hospital now" alert.
export const PLAUSIBLE: Record<VitalKind, { min: number; max: number; min2?: number; max2?: number }> = {
  bp: { min: 50, max: 260, min2: 30, max2: 160 },
  weight: { min: 30, max: 250 },
  temp: { min: 33, max: 43 },
  fhr: { min: 40, max: 250 },
  glucose: { min: 1, max: 35 },
};

// Returns a friendly error message if the reading is outside plausible bounds.
export function plausibilityError(kind: VitalKind, value: number, value2: number | null): string | null {
  const p = PLAUSIBLE[kind];
  if (!p) return null;
  const meta = vitalMeta(kind);
  if (value < p.min || value > p.max)
    return `That ${meta?.label?.toLowerCase() || "value"} (${value}) doesn't look right — please re-check and enter it again.`;
  if (p.min2 != null && value2 != null && (value2 < p.min2 || value2 > (p.max2 ?? Infinity)))
    return `That second number (${value2}) doesn't look right — please re-check and enter it again.`;
  return null;
}

export type AlertLevel = "info" | "warning" | "urgent";
export type VitalAlert = { level: AlertLevel; kind: VitalKind; message: string };

// Evaluate a single reading. Returns an alert or null. (Weight uses a trend check
// in the API, not here, since it needs the previous reading.)
export function evaluateVital(kind: VitalKind, value: number | null, value2: number | null): VitalAlert | null {
  const v = value ?? 0;
  const v2 = value2 ?? 0;

  if (kind === "bp") {
    if (v >= 160 || v2 >= 110)
      return { level: "urgent", kind, message: `Your blood pressure is very high (${v}/${v2}). Please go to a clinic or hospital now — don't wait.` };
    if (v >= 140 || v2 >= 90)
      return { level: "warning", kind, message: `Your blood pressure is high (${v}/${v2}). Please contact your provider today — especially with any headache, blurred vision, upper-tummy pain or sudden swelling.` };
  }
  if (kind === "temp") {
    if (v >= 39) return { level: "urgent", kind, message: `Your temperature is very high (${v}°C). Please seek care now.` };
    if (v >= 38) return { level: "warning", kind, message: `You have a fever (${v}°C). Rest, take fluids, and contact your provider — fever in pregnancy should be checked.` };
  }
  if (kind === "fhr") {
    if (v > 0 && (v < 110 || v > 170))
      return { level: "warning", kind, message: `Baby's heartbeat (${v} bpm) is outside the usual 110–160 range. Please contact your provider to check.` };
  }
  if (kind === "glucose") {
    if (v >= 11) return { level: "urgent", kind, message: `Your blood sugar (${v} mmol/L) is very high. Please contact your provider promptly.` };
    if (v >= 7.8) return { level: "warning", kind, message: `Your blood sugar (${v} mmol/L) is higher than usual. Mention it to your provider — it may need a glucose test.` };
  }
  return null;
}

// Weight trend: a sudden jump can signal fluid retention (pre-eclampsia).
export function evaluateWeightTrend(curr: number, prev: number | null, daysApart: number): VitalAlert | null {
  if (prev == null || daysApart <= 0) return null;
  const perWeek = (curr - prev) / (daysApart / 7);
  if (perWeek >= 3)
    return { level: "warning", kind: "weight", message: `You've gained weight quickly (about ${perWeek.toFixed(1)} kg/week). With any swelling or headache, please contact your provider.` };
  return null;
}
