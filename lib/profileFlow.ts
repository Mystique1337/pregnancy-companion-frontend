// PROGRESSIVE PROFILING. Three questions that matter enormously — where she lives
// (equity evidence + nearest facility), who carries her to hospital in an emergency
// (Delay 2), and whether her partner should be looped in (the decision-maker) — WITHOUT
// putting them in the enrolment flow where they'd cost us the sign-up.
//
// She is already fully enrolled before any of this is asked, every step is skippable,
// and abandoning it costs her nothing. Reuses the wa_onboarding state table.
import {
  getOnboarding, setOnboarding, clearOnboarding, updateMotherProfile, logAudit, type Mother,
} from "@/lib/queries";
import { parseTransportReply } from "@/lib/transport";
import { partnerWelcome } from "@/lib/partner";
import { sendWhatsApp, whatsappConfigured } from "@/lib/whatsapp";

const SKIP = /^\s*(skip|no|none|later|nothing|pass|nope|abeg no|no o)\b/i;

export const PROFILE_Q = {
  place: "📍 Two quick things that could save your life one day.\n\nFirst: which town or LGA do you live in? (Type SKIP to pass.)",
  transport: "🚕 If an emergency happens at 2am, who will carry you to hospital?\n\nSend their name and number, like: *Musa 08031234567*. (Type SKIP to pass.)",
  partner: "👨🏾 Last one — should I also warn your husband or a family member if you show a danger sign?\n\nSend their number, or type SKIP.",
} as const;

/** Kick off the flow right after enrolment. Returns the first question. */
export async function beginProfileFlow(stateKey: string): Promise<string> {
  await setOnboarding(stateKey, "ask_place", {});
  return PROFILE_Q.place;
}

function looksRural(text: string): "rural" | "urban" | null {
  const t = text.toLowerCase();
  if (/\b(village|rural|bush|farm|hamlet|community)\b/.test(t)) return "rural";
  if (/\b(city|town|urban|lagos|abuja|kano|ibadan|port harcourt|benin|kaduna|enugu)\b/.test(t)) return "urban";
  return null;
}

/**
 * Handle one turn of the post-enrolment profile flow.
 * Returns the reply to send, or null when there's no pending step (normal chat).
 */
export async function handleProfileStep(
  mother: Mother,
  text: string,
  stateKey: string,
  channel: "whatsapp" | "telegram",
): Promise<string | null> {
  const state = await getOnboarding(stateKey);
  if (!state || !["ask_place", "ask_transport", "ask_partner"].includes(state.step)) return null;
  const skipped = SKIP.test(text);

  if (state.step === "ask_place") {
    if (!skipped) {
      const place = text.trim().slice(0, 80);
      await updateMotherProfile(mother.id, { lga: place, residence: looksRural(place) ?? undefined });
      logAudit({ mother_id: mother.id, actor: "mother", action: "profile_place", channel, summary: place });
    }
    await setOnboarding(stateKey, "ask_transport", {});
    return `${skipped ? "No wahala." : "Got it, thank you."}\n\n${PROFILE_Q.transport}`;
  }

  if (state.step === "ask_transport") {
    let ack = "No wahala — but do think about who can carry you, and save their number.";
    if (!skipped) {
      const t = parseTransportReply(text);
      if (!t) return `I didn't catch a number there. Send it like *Musa 08031234567*, or type SKIP.`;
      await updateMotherProfile(mother.id, { transport_name: t.name ?? undefined, transport_phone: t.phone });
      logAudit({ mother_id: mother.id, actor: "mother", action: "profile_transport", channel });
      ack = `Saved ✅ If an emergency happens, I will alert ${t.name || "them"} straight away.`;
    }
    await setOnboarding(stateKey, "ask_partner", {});
    return `${ack}\n\n${PROFILE_Q.partner}`;
  }

  // ask_partner — last step
  await clearOnboarding(stateKey);
  if (skipped) return "No problem 🌸 That's everything — just message me any time you need me.";
  const p = parseTransportReply(text);
  if (!p) return "That's fine 🌸 That's everything — just message me any time you need me.";
  await updateMotherProfile(mother.id, { partner_phone: p.phone, partner_opt_in: true });
  logAudit({ mother_id: mother.id, actor: "mother", action: "profile_partner", channel });
  // Introduce ourselves to him so the first thing he ever gets isn't an emergency.
  if (whatsappConfigured()) {
    void sendWhatsApp(p.phone, partnerWelcome(mother)).catch(() => {});
  }
  return "Done ✅ I'll warn them if you ever show a danger sign.\n\nThat's everything — just message me any time you need me. 💛";
}

/** Let her (re)start the flow later: "setup", "/setup", "update my details". */
export function isProfileSetupRequest(text: string): boolean {
  return /^\s*\/?(setup|set up|my details|update (my )?details|emergency plan)\s*$/i.test(text || "");
}
