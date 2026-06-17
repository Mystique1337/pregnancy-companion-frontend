// Maternal wellbeing self-check — a 10-item mood screen in the style of the
// Edinburgh Postnatal Depression Scale (validated antenatally and postnatally),
// with paraphrased items. It is a screening aid, NOT a diagnosis. A high score or
// any self-harm signal routes the mother firmly toward real support.

export type MoodOption = { label: string; value: number };
export type MoodQuestion = { id: string; text: string; options: MoodOption[]; selfHarm?: boolean };

// Each item scored 0–3. Some are reverse-scored (worded positively) — encoded so
// option order already reflects the 0→3 severity.
export const MOOD_QUESTIONS: MoodQuestion[] = [
  { id: "q1", text: "I have been able to laugh and see the funny side of things", options: [
    { label: "As much as I always could", value: 0 }, { label: "Not quite so much now", value: 1 },
    { label: "Definitely not so much now", value: 2 }, { label: "Not at all", value: 3 } ] },
  { id: "q2", text: "I have looked forward with enjoyment to things", options: [
    { label: "As much as I ever did", value: 0 }, { label: "A little less than I used to", value: 1 },
    { label: "Much less than I used to", value: 2 }, { label: "Hardly at all", value: 3 } ] },
  { id: "q3", text: "I have blamed myself unnecessarily when things went wrong", options: [
    { label: "No, never", value: 0 }, { label: "Not very often", value: 1 },
    { label: "Yes, some of the time", value: 2 }, { label: "Yes, most of the time", value: 3 } ] },
  { id: "q4", text: "I have felt worried or anxious for no good reason", options: [
    { label: "No, not at all", value: 0 }, { label: "Hardly ever", value: 1 },
    { label: "Yes, sometimes", value: 2 }, { label: "Yes, very often", value: 3 } ] },
  { id: "q5", text: "I have felt scared or panicky for no very good reason", options: [
    { label: "No, not at all", value: 0 }, { label: "No, not much", value: 1 },
    { label: "Yes, sometimes", value: 2 }, { label: "Yes, quite a lot", value: 3 } ] },
  { id: "q6", text: "Things have been getting on top of me", options: [
    { label: "No, I'm coping fine", value: 0 }, { label: "Most of the time I cope well", value: 1 },
    { label: "Sometimes I haven't coped well", value: 2 }, { label: "Most of the time I haven't coped", value: 3 } ] },
  { id: "q7", text: "I have been so unhappy that I have had difficulty sleeping", options: [
    { label: "No, not at all", value: 0 }, { label: "Not very often", value: 1 },
    { label: "Yes, sometimes", value: 2 }, { label: "Yes, most of the time", value: 3 } ] },
  { id: "q8", text: "I have felt sad or miserable", options: [
    { label: "No, not at all", value: 0 }, { label: "Not very often", value: 1 },
    { label: "Yes, quite often", value: 2 }, { label: "Yes, most of the time", value: 3 } ] },
  { id: "q9", text: "I have been so unhappy that I have been crying", options: [
    { label: "No, never", value: 0 }, { label: "Only occasionally", value: 1 },
    { label: "Yes, quite often", value: 2 }, { label: "Yes, most of the time", value: 3 } ] },
  { id: "q10", text: "The thought of harming myself has occurred to me", selfHarm: true, options: [
    { label: "Never", value: 0 }, { label: "Hardly ever", value: 1 },
    { label: "Sometimes", value: 2 }, { label: "Yes, quite often", value: 3 } ] },
];

export const MOOD_MAX = MOOD_QUESTIONS.length * 3; // 30

export type MoodBand = "ok" | "monitor" | "elevated" | "urgent";

export type MoodResult = {
  score: number;
  band: MoodBand;
  selfHarmFlag: boolean;
  title: string;
  message: string;
};

export function scoreMood(answers: Record<string, number>): MoodResult {
  let score = 0;
  for (const q of MOOD_QUESTIONS) {
    const v = Number(answers[q.id]);
    if (Number.isFinite(v)) score += Math.max(0, Math.min(3, v));
  }
  const selfHarmFlag = Number(answers["q10"]) >= 1;

  let band: MoodBand;
  if (selfHarmFlag) band = "urgent";
  else if (score >= 20) band = "urgent";
  else if (score >= 13) band = "elevated";
  else if (score >= 10) band = "monitor";
  else band = "ok";

  const copy: Record<MoodBand, { title: string; message: string }> = {
    ok: { title: "🌿 You seem to be coping well", message: "Your answers don't show signs of low mood right now. Keep checking in with yourself — and reach out any time things feel heavy." },
    monitor: { title: "💛 Worth keeping an eye on", message: "Some answers suggest you've had a harder time lately. That's common in pregnancy. Be gentle with yourself, lean on people you trust, and check in again in a couple of weeks." },
    elevated: { title: "💛 You don't have to carry this alone", message: "Your answers suggest you may be struggling with your mood. This is common and treatable — please talk to your provider, midwife, or someone you trust soon. Reaching out is strength, not weakness." },
    urgent: { title: "❤️ Please reach out for support now", message: "Your answers suggest you're going through something really hard. Please talk to your provider or someone you trust today. If you ever feel you might harm yourself, contact a clinic or a helpline right away — you matter, and support is there." },
  };
  return { score, band, selfHarmFlag, ...copy[band] };
}

export const MOOD_BAND_COLOR: Record<MoodBand, { text: string; border: string; bg: string }> = {
  ok: { text: "var(--sage)", border: "var(--lavender)", bg: "var(--lav-pale)" },
  monitor: { text: "var(--gold)", border: "var(--gold)", bg: "var(--gold-lt)" },
  elevated: { text: "var(--pink)", border: "var(--pink)", bg: "var(--pink-pale)" },
  urgent: { text: "var(--pink)", border: "var(--pink)", bg: "var(--pink-pale)" },
};
