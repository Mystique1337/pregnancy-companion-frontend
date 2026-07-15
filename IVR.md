# IVR (voice-call reach) — runbook

For mothers who cannot read or type, or who only have a basic phone. She **calls a
number** and navigates by pressing keys. No app, no data, no literacy needed.

## What's built
- `lib/ivr.ts` — the voice menu + danger-sign / ANC / vaccine content, as Africa's Talking Voice XML.
- `app/api/ivr/route.ts` — the voice callback webhook (handles key presses + recorded questions → clinician alert).
- Gated on `AT_VOICE_ENABLED=true` so it stays inert until a number is live.

## Menu
1. Pregnancy danger signs (go-to-hospital list)
2. Clinic visits + free baby vaccine schedule
3. Leave a spoken question → raises an alert with the recording for a health worker
9. Repeat menu

## To go live (needs a provider — not wired to any account yet)
1. Create an [Africa's Talking](https://africastalking.com) account (works in Nigeria) and top up.
2. Provision a **voice number** (or use a SIP/phone number).
3. Set the number's **Voice callback URL** to `https://app.bumply.mom/api/ivr`.
4. On Railway, set `AT_VOICE_ENABLED=true`.
5. Call the number and test the menu.

Recorded questions (option 3) land as `ivr-question` alerts in the clinic dashboard
with the recording URL. Add transcription (Whisper) + auto-answer later if desired.

> Twilio works the same way; swap the XML dialect in `lib/ivr.ts` (`<Gather>`/`<Say>`)
> and point Twilio's voice webhook at `/api/ivr`.
