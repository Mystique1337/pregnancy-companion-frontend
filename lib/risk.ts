// Predictive maternal-risk engine. Deterministic and EXPLAINABLE — every score
// lists the factors that drove it. It screens for the three conditions behind
// most preventable maternal harm (pre-eclampsia, gestational diabetes, preterm
// labour) from self-tracked vitals + journal signals. It is a screening aid that
// points toward care — never a diagnosis.
import type { Vital } from "./queries";
import type { JournalEntry } from "./queries";

export type RiskLevel = "low" | "moderate" | "elevated" | "high";
export type RiskCondition = "preeclampsia" | "gdm" | "preterm";

export type RiskAssessment = {
  condition: RiskCondition;
  label: string;
  emoji: string;
  level: RiskLevel;
  score: number;
  factors: string[]; // human-readable drivers
  advice: string;
};

export type RiskReport = {
  week: number;
  overall: RiskLevel;
  assessments: RiskAssessment[];
};

export const LEVEL_RANK: Record<RiskLevel, number> = { low: 0, moderate: 1, elevated: 2, high: 3 };
const num = (v: number | null | undefined) => (v == null ? null : Number(v));

function latest(vitals: Vital[], kind: string): Vital | undefined {
  return vitals.find((v) => v.kind === kind); // listVitals returns newest-first
}
function trendUp(vitals: Vital[], kind: string, pick: (v: Vital) => number | null): number | null {
  const series = vitals.filter((v) => v.kind === kind).map(pick).filter((n): n is number => n != null);
  if (series.length < 2) return null;
  return series[0] - series[series.length - 1]; // newest - oldest
}

function levelFromScore(score: number): RiskLevel {
  if (score >= 6) return "high";
  if (score >= 4) return "elevated";
  if (score >= 2) return "moderate";
  return "low";
}

// Collect recent journal symptom strings (lowercased) from the last ~10 entries.
function recentSymptoms(journal: JournalEntry[]): string[] {
  return journal.slice(0, 10).flatMap((e) => (e.symptoms || []).map((s) => s.toLowerCase()));
}
const has = (syms: string[], ...needles: string[]) => syms.some((s) => needles.some((n) => s.includes(n)));

function assessPreeclampsia(week: number, firstPreg: boolean, vitals: Vital[], syms: string[]): RiskAssessment {
  let score = 0;
  const factors: string[] = [];
  const bp = latest(vitals, "bp");
  const sys = num(bp?.value), dia = num(bp?.value2);
  if (sys != null && dia != null) {
    if (sys >= 160 || dia >= 110) { score += 5; factors.push(`Severely high BP (${sys}/${dia})`); }
    else if (sys >= 140 || dia >= 90) { score += 4; factors.push(`High BP (${sys}/${dia})`); }
    else if (sys >= 130 || dia >= 85) { score += 2; factors.push(`Borderline BP (${sys}/${dia})`); }
  }
  const bpTrend = trendUp(vitals, "bp", (v) => num(v.value));
  if (bpTrend != null && bpTrend >= 15) { score += 2; factors.push(`Rising BP trend (+${Math.round(bpTrend)} systolic)`); }
  const wTrend = trendUp(vitals, "weight", (v) => num(v.value));
  if (wTrend != null && wTrend >= 3) { score += 2; factors.push(`Rapid weight gain (+${wTrend.toFixed(1)} kg)`); }
  if (has(syms, "headache")) { score += 1; factors.push("Headaches reported"); }
  if (has(syms, "swelling", "swollen")) { score += 1; factors.push("Swelling reported"); }
  if (has(syms, "vision", "blurred", "spots")) { score += 2; factors.push("Vision changes reported"); }
  if (week >= 20 && firstPreg) { score += 1; factors.push("First pregnancy after 20 weeks"); }

  const level = week < 20 ? (score >= 4 ? "moderate" : "low") : levelFromScore(score);
  return {
    condition: "preeclampsia", label: "Pre-eclampsia", emoji: "🩸", level, score, factors,
    advice: level === "high" || level === "elevated"
      ? "Please have your blood pressure and urine checked at a clinic soon — sooner if you get a headache, vision changes, or upper-tummy pain."
      : "Keep logging your BP. Report any headache, vision changes, or sudden swelling to your provider.",
  };
}

function assessGdm(vitals: Vital[], syms: string[]): RiskAssessment {
  let score = 0;
  const factors: string[] = [];
  const g = latest(vitals, "glucose");
  const gv = num(g?.value);
  if (gv != null) {
    if (gv >= 11) { score += 5; factors.push(`Very high blood sugar (${gv} mmol/L)`); }
    else if (gv >= 7.8) { score += 4; factors.push(`Raised blood sugar (${gv} mmol/L)`); }
    else if (gv >= 6.5) { score += 2; factors.push(`Upper-range blood sugar (${gv} mmol/L)`); }
  }
  const wTrend = trendUp(vitals, "weight", (v) => num(v.value));
  if (wTrend != null && wTrend >= 4) { score += 2; factors.push(`Rapid weight gain (+${wTrend.toFixed(1)} kg)`); }
  if (has(syms, "thirst", "thirsty")) { score += 1; factors.push("Excess thirst reported"); }
  if (has(syms, "frequent urination", "urination")) { score += 1; factors.push("Frequent urination reported"); }
  const level = levelFromScore(score);
  return {
    condition: "gdm", label: "Gestational diabetes", emoji: "🍬", level, score, factors,
    advice: level === "high" || level === "elevated"
      ? "Ask your provider about a glucose (OGTT) test, and favour whole grains, vegetables and less sugary drinks."
      : "If you haven't had a glucose test, mention it at your next visit. Balanced meals and gentle activity help.",
  };
}

function assessPreterm(week: number, vitals: Vital[], syms: string[]): RiskAssessment {
  let score = 0;
  const factors: string[] = [];
  if (week < 37) {
    if (has(syms, "contraction", "tightening", "cramp")) { score += 3; factors.push("Cramping / tightening reported"); }
    if (has(syms, "fluid", "leaking", "water")) { score += 4; factors.push("Fluid leaking reported"); }
    if (has(syms, "bleeding", "spotting")) { score += 3; factors.push("Bleeding / spotting reported"); }
    if (has(syms, "pelvic pressure", "pressure", "back pain")) { score += 1; factors.push("Pelvic pressure / back pain reported"); }
    const temp = num(latest(vitals, "temp")?.value);
    if (temp != null && temp >= 38) { score += 1; factors.push(`Fever (${temp}°C)`); }
  }
  const level = week >= 37 ? "low" : levelFromScore(score);
  return {
    condition: "preterm", label: "Preterm labour", emoji: "⏱️", level, score, factors,
    advice: week >= 37
      ? "You're at term — labour signs are expected now. Know the signs and have your hospital bag ready."
      : (level === "high" || level === "elevated"
        ? "Regular tightening, fluid leaking, or bleeding before 37 weeks needs a same-day clinic check — don't wait."
        : "If you notice regular tightening, fluid, or bleeding before 37 weeks, contact your clinic the same day."),
  };
}

export function assessRisk(opts: { week: number; firstPregnancy: boolean; vitals: Vital[]; journal: JournalEntry[] }): RiskReport {
  const syms = recentSymptoms(opts.journal);
  const assessments = [
    assessPreeclampsia(opts.week, opts.firstPregnancy, opts.vitals, syms),
    assessGdm(opts.vitals, syms),
    assessPreterm(opts.week, opts.vitals, syms),
  ];
  const overall = assessments.reduce<RiskLevel>((acc, a) => (LEVEL_RANK[a.level] > LEVEL_RANK[acc] ? a.level : acc), "low");
  return { week: opts.week, overall, assessments };
}

export const RISK_COLORS: Record<RiskLevel, { text: string; border: string; bg: string; label: string }> = {
  low: { text: "var(--sage)", border: "var(--lavender)", bg: "var(--lav-pale)", label: "Low" },
  moderate: { text: "var(--gold)", border: "var(--gold)", bg: "var(--gold-lt)", label: "Moderate" },
  elevated: { text: "var(--pink)", border: "var(--pink)", bg: "var(--pink-pale)", label: "Elevated" },
  high: { text: "var(--pink)", border: "var(--pink)", bg: "var(--pink-pale)", label: "High" },
};
