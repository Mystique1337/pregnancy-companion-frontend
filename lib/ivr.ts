// Voice-call (IVR) reach for mothers who can't read or type — she just calls the
// Bumply number and navigates by pressing keys. Provider-agnostic core that emits
// Africa's Talking Voice XML (the main pan-African voice API; a Nigerian caller ID
// works once a number is provisioned). Gated on AT_VOICE_ENABLED so it's inert
// until credentials + a number are added. See IVR.md.
import { NPI_SCHEDULE } from "./immunization";

export function ivrConfigured(): boolean {
  return process.env.AT_VOICE_ENABLED === "true";
}

const xml = (inner: string) => `<?xml version="1.0" encoding="UTF-8"?>\n<Response>${inner}</Response>`;
const say = (t: string) => `<Say voice="woman" playBeep="false">${t.replace(/&/g, "and").replace(/</g, "")}</Say>`;

// A GetDigits prompt that posts the pressed key back to this same webhook.
function menu(prompt: string, numDigits = 1): string {
  return xml(`<GetDigits timeout="15" finishOnKey="#" numDigits="${numDigits}">${say(prompt)}</GetDigits>${say("We did not get your choice. Goodbye.")}`);
}

const DANGER_SPOKEN = [
  "Heavy bleeding from your private part.",
  "Severe headache with blurred vision.",
  "Fever that will not go down.",
  "Baby not moving or moving much less.",
  "Fits, convulsions, or fainting.",
  "Water breaking before your due date.",
  "Severe pain in your belly.",
];

export const IVR_WELCOME = menu(
  "Welcome to Bumply, your pregnancy helper. To hear pregnancy danger signs, press 1. To hear your clinic visit and vaccine schedule, press 2. To leave a question for a health worker, press 3. To hear this again, press 9."
);

// Build the response for a pressed key. Returns Africa's Talking Voice XML.
export function ivrRespond(digit: string): string {
  switch (digit) {
    case "1":
      return xml(
        say("Here are pregnancy danger signs. If you have any of these, go to the nearest hospital now, do not wait. " + DANGER_SPOKEN.join(" ")) +
        say("Remember, if you have any of these signs, go to the hospital immediately.") +
        menu("To hear the clinic and vaccine schedule, press 2. To repeat the danger signs, press 1.")
      );
    case "2": {
      const shots = NPI_SCHEDULE.slice(0, 5)
        .map((v) => `${v.label}: ${v.vaccines.map((x) => x.name).join(", ")}.`)
        .join(" ");
      return xml(
        say("Attend all your antenatal clinic visits. After birth, your baby needs free vaccines. " + shots) +
        say("These vaccines are free and protect your baby from deadly diseases.") +
        menu("To hear pregnancy danger signs, press 1. To repeat this, press 2.")
      );
    }
    case "3":
      // Record her question; the recording URL is posted back and can be
      // transcribed + answered by a health worker (or the AI) out-of-band.
      return xml(
        say("Please say your question after the beep. Press the hash key when you finish.") +
        `<Record finishOnKey="#" maxLength="60" trimSilence="true" playBeep="true" />` +
        say("Thank you. A health worker will get your message. Goodbye.")
      );
    case "9":
    default:
      return IVR_WELCOME;
  }
}
