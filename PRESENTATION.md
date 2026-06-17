# Bumply — Presentation & Demo Guide

> A warm, AI-powered pregnancy companion built **Nigeria-first**.
> This document is for whoever is building the **slide deck** and recording the **demo video**.
> It contains the pitch, the full feature catalogue, a slide-by-slide outline, and a click-by-click demo script.

---

## 1. The one-liner

**Bumply is a personal pregnancy companion that walks with every mother — week by week — in her own language, watches for danger signs, and connects her to care.**

It lives on the **web** and on **Telegram** (chat + voice notes), so a mother can use it on a smartphone browser or entirely inside a messaging app she already has.

- **Live app:** https://bumply-production.up.railway.app
- **Telegram bot:** [@bumply_bot](https://t.me/bumply_bot)

---

## 2. The problem (set the stage)

- Nigeria carries one of the world's highest maternal-mortality burdens. Many deaths are preventable — they come from **danger signs spotted too late** (bleeding, pre-eclampsia, infection) and from **gaps between antenatal visits**.
- Mothers want trustworthy guidance **in their own language**, on the device in their hand, **between** clinic appointments.
- Generic pregnancy apps feel foreign, English-only, period-tracker-styled, and disconnected from a local clinic.

**Bumply closes that gap:** continuous, personalized, multilingual support — with a safety net that escalates real red flags to a human.

---

## 3. What Bumply is (the solution in one slide)

A subscription pregnancy companion that gives each mother:

1. A **personalized weekly journey** (what's happening with her & baby, tips, meal plan).
2. An **AI companion** she can ask anything, grounded in vetted pregnancy guidance.
3. A **safety layer** — vitals tracking, a symptom red-flag checker, and alerts that reach a clinician.
4. **Her language** — English, Yoruba, Hausa, Igbo, and Nigerian Pidgin.
5. **Access to care** — nearest hospitals, a printable doctor report, and Telegram reminders.

---

## 4. Feature catalogue

Group these into slides however you like. ⭐ = strongest demo moments.

### A. Personalized weekly journey ⭐
- Knows the mother's **current week & trimester** and counts down to her due date.
- A **"watch your baby grow"** visual + size comparison each week.
- **AI-written weekly update**: what's changing, what to expect, affirmations.
- A **7-day meal plan curated to her ethnicity/cuisine** (e.g. Yoruba amala & ewedu, Igbo ofe onugbu, Hausa tuwo & miyan kuka).

### B. AI companion chat ⭐
- Ask anything, any time — answered in a warm, concise tone.
- **RAG-grounded**: pulls from a vetted pregnancy knowledge base (NVIDIA embeddings + pgvector) blended with keyword search, so answers are anchored, not hallucinated.
- Free users get a taste; **premium** unlocks the full grounded companion.

### C. Speaks her language ⭐
- Full UI + content in **English, Yoruba, Hausa, Igbo, Pidgin**.
- One-tap **language switcher** right on the home page.

### D. Vitals tracking + red-flag alerts ⭐
- Log **blood pressure, weight, temperature, baby's heartbeat, blood sugar**.
- Each reading is checked against conservative thresholds; out-of-range readings raise an **alert** (e.g. very high BP → "go to a clinic now").
- Inline **sparkline trends** and normal-range hints.
- Alerts flow to the mother's notifications **and** the clinician portal.

### E. Symptom red-flag triage ⭐ (new)
- A guided **symptom checker** across 12 common concerns (bleeding, tummy pain, headache, reduced baby movement, waters breaking, fever, vomiting, swelling, painful urination, breathing, dizziness, itching).
- Deterministic and rule-based — **never a diagnosis** — it sorts each situation into **emergency / contact clinic today / keep an eye on it / self-care**, with clear next steps.
- Emergency & urgent outcomes **raise an alert to the clinician and the mother's notifications**, and offer a one-tap **"find hospitals near me"**.

### F. Bump photo diary (new)
- A private, **week-by-week bump photo timeline**.
- Photos are compressed in the browser and stored privately; only the mother can see them.

### G. Doctor report (printable) ⭐
- One tap generates a clean, **printable / save-as-PDF clinical summary**: an AI handover paragraph, profile, latest vitals (with out-of-range flags), alerts, and recent journal — to hand to her doctor or midwife.

### H. Hospital locator + delivery recommendation
- Finds **clinics & hospitals near her** (OpenStreetMap, no API key), sorted by distance, with **delivery-recommended** facilities flagged.

### I. Journal, mood & streaks
- Daily **mood + symptom journaling** with a gentle **streak** to build the habit; feeds the AI's understanding of her.

### J. Pregnancy tools
- **Kick counter** and **contraction timer** for later weeks.

### K. Telegram companion ⭐
- **Two-way chat on Telegram** — link the account with a one-tap code, then chat with Bumply in the app she already uses.
- **Voice notes**: send a voice message, Bumply transcribes it, answers, and can **reply with voice**.
- **All notifications** (weekly update ready, health alerts, ANC reminders, milestones) can be delivered to Telegram.

### L. Notifications, everywhere
- **Web push**, **email** (Resend), and **Telegram** — weekly updates, red-flag alerts, antenatal-visit and milestone nudges.

### M. Voice (TTS / ASR)
- Text-to-speech and speech-to-text via a self-hosted voice model, used in Telegram voice replies and in-app audio.

### N. Clinician portal (human-in-the-loop) ⭐
- A secure portal where a **clinician reviews alerts** raised by vitals & symptom checks and marks them reviewed/resolved — the human safety net behind the AI.

### O. Admin dashboard
- Manage users & plans, toggle features, set pricing, view notifications & alerts, manage clinicians.

### P. Subscription model
- **Free** tier (taste of the journey) and **Premium** (full AI companion + everything), priced for the local market (e.g. ₦2,500/mo). *Payments are stubbed for the demo.*

---

## 5. Tech architecture (one technical slide)

- **Frontend/Backend:** Next.js 16 (App Router, React 19, TypeScript) — one deployable app.
- **Database:** Postgres (self-hosted Supabase), `pgvector` for semantic search.
- **AI:** NVIDIA NIM — LLM for chat/weekly content + `nv-embedqa-e5` embeddings for RAG.
- **Search:** Meilisearch (keyword) blended with vector search → hybrid retrieval.
- **Voice:** self-hosted TTS + Whisper ASR (Modal).
- **Messaging:** Telegram Bot API (webhook, voice). **Email:** Resend.
- **Maps:** OpenStreetMap (Nominatim + Overpass).
- **Hosting / CI-CD:** Railway with GitHub push-to-deploy; scheduled jobs (weekly content, daily engagement, alerts) via GitHub Actions cron.
- **Auth:** signed JWT cookie sessions (mother / clinician / admin).

**Headline:** one app, production-deployed, with AI, search, voice, messaging, and a clinician safety loop — all wired end to end.

---

## 6. Suggested slide deck outline

1. **Title** — Bumply logo + "Your pregnancy companion, in your language." + live URL.
2. **The problem** — Nigeria maternal health; danger signs caught too late; the gap between visits.
3. **Meet Bumply** — the one-paragraph solution + the two surfaces (web + Telegram).
4. **The weekly journey** — screenshot of the dashboard (baby size, weekly update, meal plan).
5. **Ask anything** — the AI chat, grounded in vetted guidance.
6. **In her language** — the 5 languages + switcher (show the dashboard in Yoruba).
7. **A safety net** — vitals + red-flag alerts (show a high-BP alert).
8. **Symptom check** — the triage flow ending in "Get emergency care now". ⭐
9. **For her doctor** — the printable report.
10. **Care nearby** — hospital locator with a delivery-recommended flag.
11. **On Telegram** — chat + voice notes + reminders.
12. **The human loop** — clinician portal reviewing alerts.
13. **Bump diary & journal** — the warmth/retention features.
14. **How it's built** — the architecture slide.
15. **Business** — subscription model + market.
16. **Roadmap & ask** — what's next + the close.

---

## 7. Demo video script (click-by-click)

> Record at **mobile width** (~390px) — Bumply is mobile-first. Total ~3–4 minutes.
> Have a **test mother account** logged in, and seed a couple of vitals beforehand so the report and trends look alive.

**Scene 1 — Open (15s).** Land on the home page. Say the one-liner. Tap the **language switcher** → flip to **Yoruba** → show the page translate → flip back to English.

**Scene 2 — The dashboard (30s).** Log in. Show **"Hello, [name] · Week 29 · third trimester · 11 weeks to go"**, the **baby-size** card, and the **AI weekly update**. Scroll the feature tiles.

**Scene 3 — Ask the companion (30s).** Open **Chat**. Type *"I keep vomiting in the morning, what can help?"* Show the warm, grounded answer.

**Scene 4 — Vitals & a red flag (35s).** Open **Vitals**. Log a **blood pressure of 150/95**. Show the **warning alert** appear ("contact your provider today"). Mention it also reaches her notifications and her clinician.

**Scene 5 — Symptom check (35s).** ⭐ Open **Symptom check** (/triage). Pick **"Vaginal bleeding"**, tick **"heavy — soaking a pad"**, tap **See guidance** → the **"🚨 Get emergency care now"** screen with **"Find hospitals near me"**. This is the emotional peak — say *"this is the moment that can save a life."*

**Scene 6 — Doctor report (20s).** From Vitals, tap **"Generate a report for your doctor"**. Show the clean clinical summary + vitals table. Tap **Print / Save as PDF**.

**Scene 7 — Hospitals (15s).** Open **Hospitals**, type a town (e.g. *Yaba, Lagos*), show the list with a **delivery-recommended** facility.

**Scene 8 — Telegram (30s).** ⭐ In **Account**, show the **"Connect Telegram"** code. Switch to Telegram, open **@bumply_bot**, send a **voice note** ("how many weeks am I?") and show Bumply reply (text + voice). Mention reminders & alerts arrive here too.

**Scene 9 — Bump diary (15s).** Open **Bump diary**, add a photo, show it land in the week-by-week timeline.

**Scene 10 — The human loop (20s).** Open the **clinician portal**, show the **alert** from Scene 4/5 waiting to be reviewed → mark it reviewed. *"AI watches; a human confirms."*

**Scene 11 — Close (15s).** Back to the home page / logo. Recap: *one companion — personalized, multilingual, safe, connected to care.* Show the live URL + bot handle.

---

## 8. Key talking points / differentiators

- **Nigeria-first, not localized-as-an-afterthought** — 5 languages and local cuisine in the meal plan.
- **Safety with a human in the loop** — it doesn't just chat; it escalates real danger signs to a clinician.
- **Meets mothers where they are** — fully usable inside **Telegram**, including **voice** for low-literacy or hands-busy moments.
- **Grounded AI** — answers anchored to vetted guidance (RAG), not free-floating model output.
- **Bridges to the clinic** — a printable doctor report turns self-tracked data into something a provider can act on.
- **Already live & shipping** — production-deployed with push-to-deploy CI/CD and scheduled jobs.

---

## 9. Access & credentials (fill in before sharing)

- **Live app:** https://bumply-production.up.railway.app
- **Telegram bot:** https://t.me/bumply_bot
- **Demo mother login:** _create a test account at sign-up, or use a pre-seeded one_
- **Admin / clinician logins:** _ask the team — kept out of this shared doc on purpose_

> ⚠️ Demo notes: payments are **stubbed** (no real billing). The demo email sender only reaches the project's own inbox until a sending domain is verified. None of the content is medical advice — every screen routes the mother to her provider.

---

## 10. Roadmap (the "what's next" slide)

- Verified email domain + real payment integration.
- Photo/vision understanding (e.g. reading a scan or a rash) on the companion.
- Auto-generated short weekly **video** updates.
- Deeper clinician tooling (caseloads, two-way messaging).
- Expanded knowledge base + more languages/dialects.

---

*Built with care. Bumply 🤍*
