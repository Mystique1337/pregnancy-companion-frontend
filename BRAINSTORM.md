# Bumply — where to take it next (brainstorm)

Lens: **"Would the woman on slide 3 actually use this?"** — a Nigerian mother on WhatsApp
daily, code-switching Yoruba/Pidgin, maybe can't read English, ₦45k Android on 3G, won't
explore hidden features. Judged by HelpMum (CareCode Hackathon, deadline 20 Jul 2026).

Legend: 🟢 built · 🟡 partial · ⬜ idea. Effort: S/M/L. Value for the persona: ★–★★★.

---

## Already shipped this cycle
- 🟢 WhatsApp self-onboarding (text to join, no app)
- 🟢 Close-the-loop outcomes + clinic impact metric
- 🟢 Postpartum mode + free-immunization reminders
- 🟢 Photo understanding (ANC card / drug / test) on WhatsApp — free NVIDIA vision
- 🟢 Offline "Am I okay?" (danger checks + curated KB + on-device SmolLM + on-device photo)
- 🟢 Local (on-device) voice everywhere — speak & listen with no network / no Modal bill
- 🟢 Voice-first + accessibility pass (48px taps, WCAG-AA contrast, read-aloud, Help/SOS tab)
- 🟢 Onboarding form: language-first, short, localized core
- 🟢 Auditable tests: unit suite (41 checks) + Playwright UI/a11y + e2e

## Voice & language (her primary modality)
- ⬜ **Yoruba/Hausa/Igbo danger keywords in the on-device checker** — S · ★★★. Today the
  offline danger regex is English+Pidgin. Add native-language red-flag terms so a Yoruba-only
  mother is protected offline. Highest safety-per-effort.
- ⬜ **Voice onboarding** — M · ★★. Let her sign up by *speaking* name + weeks (local ASR)
  instead of typing. Removes the last literacy wall in signup.
- 🟡 **Whole-app translation** — M · ★★. SOS + immunization page bodies are still English;
  add a language picker on public pages (read cached profile / localStorage) and localize.
- ⬜ **"Bumply reads your update aloud"** — S · ★. A play button on the weekly update + dashboard
  so she can listen to her week instead of reading it.

## WhatsApp depth (the channel she's actually in)
- ⬜ **WhatsApp buttons / list menus** — S · ★★. Evolution supports interactive buttons; replace
  "reply 1/2/3" with tappable buttons for danger-check, clinic-finder, vaccine schedule.
- ⬜ **Scheduled WhatsApp check-ins** — S · ★★. "How are you feeling this week?" nudge → her
  reply runs the danger check + logs a journal entry. Keeps low-literacy mothers engaged without
  opening the app.
- ⬜ **Group/"kinkeeper" opt-in** — M · ★. Let a mother add a trusted relative who gets the
  danger alerts too (she may not have the phone in a crisis).

## Clinical / impact (what HelpMum cares about)
- ⬜ **CHW analytics + CSV export** — S · ★★. From the close-the-loop data: mothers reached,
  danger signs caught, % who sought care, response times. A one-screen "impact report" is a
  strong demo + real M&E value for a nonprofit.
- ⬜ **Referral hand-off** — M · ★★. When a danger alert fires, one tap sends the nearest
  facility + a pre-filled referral note to the mother and CHW.
- ⬜ **Immunization defaulter tracking** — S · ★★. Flag babies who missed a due vaccine window;
  CHW gets a follow-up list. Directly moves the immunization-coverage needle.
- ⬜ **Postpartum depression screen (EPDS-lite) by voice** — M · ★★. A short spoken check-in;
  elevated score → gentle message + CHW alert.

## On-device / build-small (second hackathon)
- 🟡 **Fine-tuned tiny maternal model** — L · ★. Pipeline is ready (`modal/finetune.py`);
  run it, distil to SmolLM-size, convert to ONNX, host, and point OfflineHelper at it for
  better offline answers baked into weights.
- ⬜ **On-device danger classifier** — M · ★★. A tiny text classifier (or the KB retriever)
  tuned to danger signs so offline triage is even more robust than regex.
- ⬜ **Grow the offline KB** — S · ★★. Expand `maternal-qa.json` from 24 → ~100 vetted Q&A
  (nutrition, postpartum, newborn, mental health) — immediate offline quality lift, zero GPU.

## Reliability / ops
- ⬜ **SMS fallback** — S · ★★ (needs a provider token). Code is dormant; when a token lands,
  danger alerts + reminders reach basic phones with no WhatsApp.
- ⬜ **Delivery receipts + retry** — S · ★. Track WhatsApp send status; retry/escalate to
  Telegram/SMS if a critical alert isn't delivered.
- ⬜ **Rate-limit + abuse guard on public webhook/onboarding** — S · ★. Prevent a flood of
  fake onboardings from a spam number.

## Top picks if I keep going (my recommendation)
1. **Native-language offline danger keywords** (S, ★★★ safety) — protects non-English readers offline.
2. **CHW impact report + CSV** (S, ★★ — best demo/impact for HelpMum judges).
3. **Grow the offline KB to ~100 Q&A** (S, ★★ — offline quality, no cost).
4. **WhatsApp interactive buttons + weekly check-in** (S–M, ★★ — engagement in her real channel).
5. **Voice onboarding** (M, ★★ — removes the last literacy wall).
