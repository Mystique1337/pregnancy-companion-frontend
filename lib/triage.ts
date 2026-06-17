// Pregnancy symptom red-flag triage. Rule-based and DETERMINISTIC — never an AI
// guess and never a diagnosis. Every path ends by pointing the mother to care or
// to her provider. Thresholds follow common antenatal danger-sign guidance
// (WHO / NICE-style), framed for a Nigeria-first audience.

export type TriageLevel = "emergency" | "urgent" | "caution" | "selfcare";

export const LEVEL_RANK: Record<TriageLevel, number> = { selfcare: 0, caution: 1, urgent: 2, emergency: 3 };

export type TriageQuestion = {
  id: string;
  text: string;
  level: TriageLevel; // answering YES makes the outcome AT LEAST this severe
};

export type Symptom = {
  id: string;
  label: string;
  emoji: string;
  lead?: string; // short reassuring framing shown above the questions
  questions: TriageQuestion[];
  baseline: TriageLevel; // outcome when no danger question is answered "yes"
  tips?: string[]; // self-care suggestions shown for caution / selfcare outcomes
};

export const SYMPTOMS: Symptom[] = [
  {
    id: "bleeding",
    label: "Vaginal bleeding",
    emoji: "🩸",
    lead: "Any bleeding in pregnancy should be checked — let's see how urgent.",
    baseline: "urgent",
    questions: [
      { id: "heavy", text: "Is it heavy — soaking a pad, or passing clots?", level: "emergency" },
      { id: "pain", text: "Is there severe or constant tummy pain with it?", level: "emergency" },
      { id: "faint", text: "Do you feel dizzy, faint, or have a racing heart?", level: "emergency" },
    ],
  },
  {
    id: "abdo",
    label: "Tummy / belly pain",
    emoji: "🤰",
    lead: "Some aches are normal as you stretch — but a few patterns need attention.",
    baseline: "caution",
    tips: [
      "Rest and change position slowly — stretching ligaments often ease with movement.",
      "A warm (not hot) compress on the area can help.",
      "Stay hydrated and empty your bladder regularly.",
    ],
    questions: [
      { id: "severe", text: "Is the pain severe, constant, and not easing?", level: "emergency" },
      { id: "bleed", text: "Is there any bleeding with it?", level: "emergency" },
      { id: "preterm", text: "Are you under 37 weeks with regular tightening/cramps?", level: "urgent" },
      { id: "ribs", text: "Is the pain high up, under your ribs (especially the right side)?", level: "urgent" },
      { id: "fever", text: "Do you also have a fever?", level: "urgent" },
    ],
  },
  {
    id: "headache",
    label: "Headache",
    emoji: "🤕",
    lead: "Headaches are common, but a severe one with other signs can matter.",
    baseline: "caution",
    tips: [
      "Rest in a cool, dark room and drink water — dehydration is a common trigger.",
      "Eat regular meals; low blood sugar can bring on headaches.",
      "Paracetamol is generally considered safe in pregnancy — check the dose with your pharmacist.",
    ],
    questions: [
      { id: "vision", text: "Any blurred vision, flashing lights, or spots before your eyes?", level: "emergency" },
      { id: "severe", text: "Is it severe and not easing with rest or paracetamol?", level: "urgent" },
      { id: "swelling", text: "Any sudden swelling of your face or hands?", level: "urgent" },
      { id: "ribs", text: "Any pain in your upper tummy, under the ribs?", level: "urgent" },
    ],
  },
  {
    id: "movements",
    label: "Baby's movements",
    emoji: "👣",
    lead: "Your baby's pattern matters more than a fixed number. A drop is always worth a same-day call.",
    baseline: "urgent",
    questions: [
      { id: "none", text: "Have you felt no movements at all for several hours?", level: "urgent" },
      { id: "less", text: "Are movements much less than your normal pattern?", level: "urgent" },
      { id: "bleedpain", text: "Is there also bleeding or tummy pain?", level: "emergency" },
    ],
  },
  {
    id: "waters",
    label: "Fluid leaking / waters",
    emoji: "💧",
    lead: "A gush or steady trickle of fluid can mean your waters have broken.",
    baseline: "urgent",
    questions: [
      { id: "color", text: "Is the fluid green, brown, or bad-smelling?", level: "emergency" },
      { id: "preterm", text: "Are you under 37 weeks?", level: "urgent" },
      { id: "contractions", text: "Are you having tightening or contractions?", level: "urgent" },
    ],
  },
  {
    id: "fever",
    label: "Fever / feeling hot",
    emoji: "🌡️",
    lead: "Fever in pregnancy should be checked — let's gauge it.",
    baseline: "caution",
    tips: [
      "Rest, take plenty of fluids, and keep cool.",
      "Paracetamol can bring a temperature down — check the dose with your pharmacist.",
      "Recheck your temperature in a few hours and seek care if it climbs.",
    ],
    questions: [
      { id: "high", text: "Is your temperature 39°C or above?", level: "emergency" },
      { id: "mid", text: "Is it 38°C or above?", level: "urgent" },
      { id: "urine", text: "Any burning urine, or back/side pain?", level: "urgent" },
      { id: "rash", text: "Any new rash, or chills and shaking?", level: "urgent" },
    ],
  },
  {
    id: "vomiting",
    label: "Vomiting / can't keep food down",
    emoji: "🤢",
    lead: "Sickness is common early on, but it shouldn't leave you unable to keep fluids down.",
    baseline: "caution",
    tips: [
      "Eat small, bland meals often; a dry biscuit before getting up can help.",
      "Sip fluids or ORS (oral rehydration salts) steadily through the day.",
      "Ginger and avoiding strong smells help many mothers.",
    ],
    questions: [
      { id: "blood", text: "Is there blood in your vomit?", level: "emergency" },
      { id: "nofluid", text: "Have you been unable to keep any food or water down for 24 hours?", level: "urgent" },
      { id: "dry", text: "Very little or dark urine, dizziness, or a dry mouth?", level: "urgent" },
      { id: "painfever", text: "Any tummy pain or fever with it?", level: "urgent" },
    ],
  },
  {
    id: "swelling",
    label: "Swelling",
    emoji: "🦶",
    lead: "Mild swelling of the feet is normal late on — sudden swelling elsewhere is not.",
    baseline: "caution",
    tips: [
      "Rest with your feet up when you can, and avoid standing for long.",
      "Wear comfortable shoes and stay hydrated.",
      "Gentle movement and cooler conditions help.",
    ],
    questions: [
      { id: "head", text: "Any headache or vision changes with it?", level: "emergency" },
      { id: "leg", text: "Is one leg painful, red, warm, and more swollen than the other?", level: "emergency" },
      { id: "face", text: "Did your face or hands swell up suddenly?", level: "urgent" },
    ],
  },
  {
    id: "urine",
    label: "Painful / burning urination",
    emoji: "🚽",
    lead: "Urine infections are common in pregnancy and treated promptly to keep you and baby safe.",
    baseline: "urgent",
    questions: [
      { id: "fever", text: "Any fever, or pain in your back or side?", level: "urgent" },
      { id: "blood", text: "Any blood in your urine?", level: "urgent" },
    ],
  },
  {
    id: "breathing",
    label: "Breathing / chest",
    emoji: "🫁",
    lead: "Some breathlessness is normal as baby grows — sudden symptoms are not.",
    baseline: "urgent",
    questions: [
      { id: "sudden", text: "Sudden shortness of breath or chest pain?", level: "emergency" },
      { id: "blood", text: "Are you coughing up blood?", level: "emergency" },
      { id: "leg", text: "Is one leg swollen and painful too?", level: "emergency" },
    ],
  },
  {
    id: "dizzy",
    label: "Dizziness / fainting",
    emoji: "😵‍💫",
    lead: "Light-headedness happens, especially standing up — fainting needs a closer look.",
    baseline: "caution",
    tips: [
      "Stand up slowly and sit or lie down if you feel light-headed.",
      "Eat and drink regularly; don't go long without food.",
      "Lie on your side rather than flat on your back later in pregnancy.",
    ],
    questions: [
      { id: "bleedpain", text: "Any bleeding or tummy pain with it?", level: "emergency" },
      { id: "fainted", text: "Did you actually faint or pass out?", level: "urgent" },
      { id: "palp", text: "Any chest pain or a racing/pounding heart?", level: "urgent" },
    ],
  },
  {
    id: "itching",
    label: "Itching",
    emoji: "🖐️",
    lead: "Mild itching from stretching skin is common — one pattern needs checking.",
    baseline: "selfcare",
    tips: [
      "Moisturise often; cool baths and loose cotton clothes soothe the skin.",
      "Avoid very hot water and heavily perfumed products.",
    ],
    questions: [
      { id: "palms", text: "Severe itching on your palms and soles, worse at night?", level: "urgent" },
      { id: "jaundice", text: "Any yellowing of your eyes/skin, or dark urine?", level: "urgent" },
    ],
  },
];

export function getSymptom(id: string): Symptom | undefined {
  return SYMPTOMS.find((s) => s.id === id);
}

/** Compute the triage outcome from a symptom + the question ids answered "yes". */
export function assessTriage(symptomId: string, yesIds: string[]): { level: TriageLevel; symptom: Symptom } | null {
  const symptom = getSymptom(symptomId);
  if (!symptom) return null;
  let level = symptom.baseline;
  for (const q of symptom.questions) {
    if (yesIds.includes(q.id) && LEVEL_RANK[q.level] > LEVEL_RANK[level]) level = q.level;
  }
  return { level, symptom };
}

export const LEVEL_COPY: Record<TriageLevel, { title: string; action: string; tone: "pink" | "gold" | "sage" }> = {
  emergency: {
    title: "🚨 Get emergency care now",
    action: "Go to the nearest hospital straight away, or call for help. Do not wait at home. If you can, take someone with you.",
    tone: "pink",
  },
  urgent: {
    title: "📞 Contact your clinic today",
    action: "Call your midwife, clinic or doctor today and tell them about this. If it gets worse, go in straight away.",
    tone: "gold",
  },
  caution: {
    title: "👀 Keep a close eye on this",
    action: "This may be normal, but watch it. Mention it at your next antenatal visit, and contact your provider if it worsens or doesn't settle.",
    tone: "gold",
  },
  selfcare: {
    title: "🌿 Usually a normal part of pregnancy",
    action: "This is common and the tips below may help. Always trust your body — if you're worried, it's okay to ask your provider.",
    tone: "sage",
  },
};

export const TRIAGE_DISCLAIMER =
  "This is general guidance, not a diagnosis. Your provider and your own instincts always come first.";
