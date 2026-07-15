// Nigeria routine immunization schedule (National Programme on Immunization / WHO).
// Used for postpartum continuity: once a baby is born we remind the mother which
// free vaccines are due and when, so a child completes the schedule. Content is
// static + offline-cacheable; the "what's due now" calc keys off the birth date.

export type Vaccine = { name: string; protects: string };
export type ScheduleVisit = { ageWeeks: number; label: string; vaccines: Vaccine[] };

// ageWeeks = weeks after birth (0 = at birth). 9 months ≈ 39 weeks, 15 months ≈ 65.
export const NPI_SCHEDULE: ScheduleVisit[] = [
  { ageWeeks: 0, label: "At birth", vaccines: [
    { name: "BCG", protects: "tuberculosis" },
    { name: "OPV 0", protects: "polio" },
    { name: "Hepatitis B (birth dose)", protects: "hepatitis B" },
  ] },
  { ageWeeks: 6, label: "6 weeks", vaccines: [
    { name: "Penta 1", protects: "diphtheria, tetanus, whooping cough, hepatitis B, Hib" },
    { name: "OPV 1", protects: "polio" },
    { name: "PCV 1", protects: "pneumonia" },
    { name: "Rotavirus 1", protects: "severe diarrhoea" },
  ] },
  { ageWeeks: 10, label: "10 weeks", vaccines: [
    { name: "Penta 2", protects: "diphtheria, tetanus, whooping cough, hepatitis B, Hib" },
    { name: "OPV 2", protects: "polio" },
    { name: "PCV 2", protects: "pneumonia" },
    { name: "Rotavirus 2", protects: "severe diarrhoea" },
  ] },
  { ageWeeks: 14, label: "14 weeks", vaccines: [
    { name: "Penta 3", protects: "diphtheria, tetanus, whooping cough, hepatitis B, Hib" },
    { name: "OPV 3", protects: "polio" },
    { name: "PCV 3", protects: "pneumonia" },
    { name: "IPV", protects: "polio (injectable)" },
    { name: "Rotavirus 3", protects: "severe diarrhoea" },
  ] },
  { ageWeeks: 39, label: "9 months", vaccines: [
    { name: "Measles 1", protects: "measles" },
    { name: "Yellow Fever", protects: "yellow fever" },
    { name: "MenA", protects: "meningitis A" },
    { name: "Vitamin A", protects: "immunity (supplement)" },
  ] },
  { ageWeeks: 65, label: "15 months", vaccines: [
    { name: "Measles 2", protects: "measles" },
  ] },
];

export type VisitStatus = "done" | "due" | "upcoming";
export type DueVisit = ScheduleVisit & { status: VisitStatus; dueDate: string | null; ageDoneBy: number };

// Whole weeks since birth (>= 0), or null if no birth date.
export function weeksSinceBirth(birthDate: string | null | undefined, now: Date): number | null {
  if (!birthDate) return null;
  const b = Date.parse(birthDate);
  if (Number.isNaN(b)) return null;
  return Math.max(0, Math.floor((now.getTime() - b) / (7 * 24 * 3600 * 1000)));
}

// Annotate the schedule with status relative to the baby's current age.
// A visit is "due" from its age up to 3 weeks after (grace window); before that
// it's "upcoming"; once the grace window passes we treat it as done/missed → "done"
// styling so the list stays forward-looking. `birthDate` may be null (pure reference).
export function immunizationPlan(birthDate: string | null | undefined, now: Date): { weeks: number | null; visits: DueVisit[] } {
  const weeks = weeksSinceBirth(birthDate, now);
  const b = birthDate ? Date.parse(birthDate) : NaN;
  const visits = NPI_SCHEDULE.map((v): DueVisit => {
    let status: VisitStatus = "upcoming";
    if (weeks != null) {
      if (weeks >= v.ageWeeks + 4) status = "done";
      else if (weeks >= v.ageWeeks) status = "due";
      else status = "upcoming";
    }
    const dueDate = Number.isNaN(b) ? null : new Date(b + v.ageWeeks * 7 * 24 * 3600 * 1000).toISOString().slice(0, 10);
    return { ...v, status, dueDate, ageDoneBy: v.ageWeeks + 4 };
  });
  return { weeks, visits };
}

// The single next visit that is due or coming up — for a short reminder message.
export function nextImmunization(birthDate: string | null | undefined, now: Date): DueVisit | null {
  const { visits } = immunizationPlan(birthDate, now);
  return visits.find((v) => v.status === "due") || visits.find((v) => v.status === "upcoming") || null;
}

// A short WhatsApp-friendly reminder line for the next due/upcoming visit.
export function immunizationReminder(name: string, birthDate: string | null | undefined, now: Date): string | null {
  const next = nextImmunization(birthDate, now);
  if (!next) return null;
  const shots = next.vaccines.map((x) => x.name).join(", ");
  const when = next.status === "due" ? "is due now" : next.dueDate ? `is due on ${next.dueDate}` : "is coming up";
  return `💉 ${name}, your baby's *${next.label}* immunization ${when}: ${shots}. It's free at your health centre — please don't miss it. These vaccines protect against killer diseases like measles, polio and pneumonia.`;
}
