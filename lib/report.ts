import { ai, AI_MODEL } from "./ai";
import { resolveModel } from "./settings";
import { trimesterFor } from "./babyData";
import type { Mother, Vital, Alert } from "./queries";

// A concise, factual clinical handover paragraph for the mother to show her doctor.
// No diagnosis, no treatment — just the key points a clinician should know.
export async function clinicalSummary(
  mother: Mother,
  week: number,
  vitals: Vital[],
  alerts: Alert[],
  journalSummary: string
): Promise<string> {
  const vitalsText =
    vitals.slice(0, 12).map((v) => `${v.kind} ${v.value ?? ""}${v.value2 ? `/${v.value2}` : ""}${v.unit ? ` ${v.unit}` : ""} (${new Date(v.created_at).toISOString().slice(0, 10)})`).join("; ") || "none logged";
  const alertsText = alerts.slice(0, 6).map((a) => `[${a.level}] ${a.message}`).join(" | ") || "none";
  const edd = mother.due_date ? new Date(mother.due_date).toISOString().slice(0, 10) : "unknown";

  const prompt = `Write ONE concise clinical handover paragraph (4–6 short sentences) for a pregnant patient to show her doctor. Neutral and factual. Do NOT diagnose or advise treatment.
Patient: ${mother.full_name}, gestational week ${week} (${trimesterFor(week)} trimester), EDD ${edd}. First pregnancy: ${mother.first_pregnancy ? "yes" : "no"}.${mother.dietary_restrictions ? ` Dietary: ${mother.dietary_restrictions}.` : ""}
Recent self-logged vitals: ${vitalsText}.
Automated flags raised: ${alertsText}.
Recent symptoms/mood (self-reported): ${journalSummary || "none recorded"}.
Summarise the points a clinician should review. End the paragraph with: "All self-reported via the Bumply app; please verify clinically."`;

  const model = await resolveModel(AI_MODEL);
  const c = await ai.chat.completions.create({
    model,
    temperature: 0.3,
    max_tokens: 320,
    messages: [
      { role: "system", content: "You write concise, factual clinical summaries for handover. Never diagnose or recommend treatment." },
      { role: "user", content: prompt },
    ],
  });
  return c.choices[0]?.message?.content?.trim() || "";
}
