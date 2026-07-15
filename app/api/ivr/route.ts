import { ivrConfigured, ivrRespond, IVR_WELCOME } from "@/lib/ivr";
import { getMotherByPhone, createAlert } from "@/lib/queries";

// Africa's Talking Voice callback. Configure this URL as the voice callback for a
// provisioned number, and set AT_VOICE_ENABLED=true. She calls the number and
// navigates by pressing keys — no reading or typing needed. Responds with Voice XML.
export const dynamic = "force-dynamic";

function voiceXml(body: string) {
  return new Response(body, { headers: { "Content-Type": "application/xml; charset=utf-8" } });
}

export async function POST(req: Request) {
  if (!ivrConfigured()) return voiceXml(`<?xml version="1.0"?><Response><Say>This service is not available yet. Goodbye.</Say></Response>`);

  const form = await req.formData().catch(() => null);
  const digits = String(form?.get("dtmfDigits") || "").trim();
  const caller = String(form?.get("callerNumber") || "").replace(/\D/g, "");
  const recordingUrl = String(form?.get("recordingUrl") || "").trim();

  // If she recorded a question (option 3), raise it for a health worker to follow up.
  if (recordingUrl && caller) {
    try {
      const mother = await getMotherByPhone(caller);
      if (mother) {
        await createAlert(mother.id, { level: "warning", kind: "ivr-question", message: `Voice question from IVR call: ${recordingUrl}` });
      }
    } catch { /* ignore */ }
    return voiceXml(`<?xml version="1.0"?><Response><Say>Thank you. A health worker will follow up. Goodbye.</Say></Response>`);
  }

  // First leg of the call has no digits yet → play the welcome menu.
  return voiceXml(digits ? ivrRespond(digits) : IVR_WELCOME);
}

// Africa's Talking may probe with GET.
export async function GET() {
  return voiceXml(IVR_WELCOME);
}
