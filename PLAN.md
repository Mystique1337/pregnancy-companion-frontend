# Bumply → CareCode Hackathon 2.0 — Winning Plan

**Deadline: 20 July 2026.** Prize ₦10M. Judged by HelpMum. The whole plan is built
around one question from their deck: *"Would the woman on slide 3 actually use this?"*

## Who she is (from the brief)
Mother, late 20s–30s. ₦45k Android, 3G. **Uses WhatsApp every day for everything.**
Code-switches Yoruba/Pidgin mid-sentence. May not read long English. Busy, sometimes
scared, not a tech user, **won't explore features**. "If it isn't obvious, she leaves."

## The hard truth about the current app
Bumply today is a rich **web app** with ~15 pages, logins, and lots of features. That is
built for judges/portfolio, not for her. The deck says that loses. We reframe.

---

## The strategy (what wins)

1. **Live where she lives: WhatsApp.** Make WhatsApp the primary surface via the official
   **WhatsApp Cloud API** (Meta) — not Evolution/Baileys (that got us soft-banned before).
   The web app becomes the **Community Health Worker (CHW) + clinician** layer, not her surface.
2. **Use HelpMum's open-source brain.** Swap the chat model to **HelpMum MamaBot Llama**
   (open-source, maternal-health-tuned Llama 3.1) with **Vax Llama** datasets as the RAG
   knowledge base. This satisfies the hard open-source requirement AND makes answers
   domain-correct. (Keep NVIDIA as a fallback.)
3. **No reading required: voice + her language.** She sends a **voice note in Pidgin/Yoruba**,
   Bumply replies **by voice** in the same language. We already have this (Whisper + SoroTTS).
4. **No login, ever.** Her WhatsApp number is her identity. This deletes the entire "have to
   create an account again" problem. (Web/CHW side keeps sliding-session auth — already shipped.)
5. **One obvious job: catch danger signs in time.** The impact core is a **danger-sign checker
   + ANC + immunization reminders**, pushed proactively in her language at the right moment.
6. **Reach the unreachable: USSD/SMS fallback.** For no-data/feature-phone moments, a
   **USSD short-code** (*347*#) via **Africa's Talking** does a danger-sign check + reminder.

## The impact path (draw the line for the judges)
WhatsApp/USSD reaches her on the phone she already uses → danger-sign info **in her language,
at the right time** → she recognises a sign (bleeding, swelling, fever, reduced movement) →
she seeks care early → contributes to cutting the **82 deaths/day**. Immunisation reminders
extend the same line past birth (HelpMum's core, 400k caregivers).

---

## Build order for 5 days (ruthless)

**P0 — the winning core (must ship):**
- WhatsApp Cloud API channel (inbound + outbound, template + session messages).
- MamaBot Llama as the brain + Vax Llama datasets in the RAG KB.
- Voice-note in / voice-note out, Pidgin + Yoruba (+ Hausa/Igbo).
- Danger-sign checker (our triage flow) delivered conversationally in WhatsApp.
- ANC + immunisation reminder drip (behaviour-change chain).
- Zero-login (WhatsApp number = identity).

**P1 — reach + trust:**
- USSD/SMS fallback via Africa's Talking (danger-sign check + reminder for no-data users).
- CHW mode (a CHW enrols/tracks mothers in her LGA, gets alerts) — the distribution engine.
- Emergency: nearest hospital + alert next-of-kin (already built; surface in WhatsApp).

**P2 — polish + inclusion:**
- Nigerian Sign Language **pre-recorded video** clips for the danger-sign + ANC messages
  (deployable, low-data). NOT real-time sign recognition — that won't run on a ₦45k phone/3G
  and breaks the "simplicity" rule.
- Immunisation tracker (birth→5) mirroring HelpMum's Vaccination Tracker.
- Clinician portal / population dashboard for the sustainability story.

## Cheap channel infrastructure (the "what SMS/WhatsApp" question)
- **WhatsApp Cloud API (Meta, official):** service/user-initiated conversations are effectively
  free; utility templates are cents. Reliable, no ban risk. **Primary channel.**
- **Africa's Talking:** SMS + **USSD** + Voice, pay-as-you-go (~₦2–4/SMS, no monthly fee),
  Africa-first. **Best for USSD/SMS fallback + OTP.**
- **Termii (Nigerian):** SMS/WhatsApp/Voice OTP, cheap local rates — a good backup for OTP.
- Telegram: keep only as an optional power-user channel. It is **not** what she uses; do not
  centre the pitch on it. (A new bot token is a 2-minute BotFather task if we want it.)

## The account fix (root cause + fix)
- **Root cause:** no password recovery + web sessions lost across browsers (WhatsApp in-app
  browser, new device) → she re-signs-up. Confirmed: a real phone registered twice.
- **Shipped now:** sliding sessions (active users never silently log out).
- **Real fix:** go passwordless — WhatsApp/phone-number identity, OTP only when needed. Removes
  the problem class entirely and fits "obvious, no friction."

## Sustainability (the deck's #3 killer)
Partner with HelpMum: deploy on their **CHW network** + open-source infra + government handover
path (they just handed vaccine tools to the Nigerian govt). Revenue: B2B2C to **State Primary
Healthcare Boards / HMOs / clinics**, clinician portal as the product. Not "figure it out later."

## Decisions / access needed to execute
1. **WhatsApp Cloud API:** a Meta Business account + a phone number + the Cloud API token
   (or confirm we use an existing HelpMum/your number).
2. **MamaBot Llama / Vax Llama:** point me to where they're hosted (Hugging Face repo or an
   endpoint) so I wire them in.
3. **Africa's Talking (or Termii)** account for USSD/SMS — optional for P1.
4. Confirm the **WhatsApp-first pivot** (web app becomes CHW/clinician layer).

## Sources
- HelpMum hackathon: https://helpmum.org/hackathon
- MamaBot: https://helpmum.org/mamabot
- MamaBot Llama (open-source): https://helpmum.org/blog/launch-of-helpmum-africa-mamabot-llama
- WhatsApp-based chatbot impact: https://allafrica.com/stories/202510240001.html
- Vaccination tools → govt: https://techcabal.com/2025/09/04/helpmum-hands-over-digital-vaccine-tools-to-nigerian-government-setting-stage-for-nationwide-rollout/
