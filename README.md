# Bumply — the AI pregnancy companion that meets Nigerian mothers where they are

**Live:** https://app.bumply.mom · **WhatsApp:** +234 815 417 4140 · **Telegram:** @My_bumplycompanionbot
**Android:** installable APK (see [ANDROID.md](./ANDROID.md)) · **Testing:** [DEMO-TESTING.md](./DEMO-TESTING.md)

Built for the **HelpMum CareCode Hackathon** (+ the "build-small" on-device track).

---

## The problem

Nigeria has one of the world's highest maternal-mortality rates. The woman most at risk
is often the one a typical health app never reaches: she lives on **WhatsApp**, code-switches
**English / Pidgin / Yoruba / Hausa / Igbo**, may **not read English well**, uses a **₦45k
Android on patchy 3G**, and **won't go exploring** menus. Most danger signs are missable and
most deaths are preventable if she gets to care in time.

**Our guiding question for every feature: _"Would the woman on slide 3 actually use this?"_**

## What Bumply is

A **WhatsApp-first** pregnancy & newborn companion with a supporting web app + installable
Android app. She can **talk to it by voice**, it **watches for danger signs in her own words
and language**, it **works offline**, and it loops a **community health worker (CHW)** in when
something is wrong — then tracks whether she actually reached care.

---

## Major selling points (the pitch)

1. **Zero-friction reach.** She joins by **texting the WhatsApp number** — no app, no signup
   form, no data plan. Bumply asks her name + how far along she is, and she's in.
2. **Danger-sign detection in her own words + language.** A deterministic checker runs on
   every message (English, Pidgin, **and native Yoruba/Hausa/Igbo terms**) *before* any AI, so
   a red flag (bleeding, convulsions, baby-not-moving, fever, pre-eclampsia signs, newborn
   danger) always gets an **instant, correct "go to hospital now"** + a CHW alert.
3. **Voice-first, for non-readers.** She can send a **voice note** and get a **spoken reply in
   her language**. Read-aloud buttons everywhere. Even the signup can be done **by voice**.
4. **Works offline.** An installable app with an on-device danger checker, a curated **103-item
   maternal Q&A knowledge pack**, and a **tiny AI model that runs in the phone** — so the
   "midwife in her pocket" answers even with no signal.
5. **Photo understanding.** She snaps her **ANC card, a medicine, or a test result** and Bumply
   reads it back in plain language and flags anything worrying (e.g. high BP, low blood count).
6. **Human-in-the-loop + measurable impact.** CHWs enrol mothers, receive danger alerts, and
   **close the loop** ("did she reach care?"). A one-screen **impact report + CSV export** turns
   this into real M&E data a nonprofit can report on.
7. **Whole-lifecycle.** Pregnancy → **postpartum mode** (newborn danger signs, her recovery) →
   **free immunization reminders** on Nigeria's national schedule.

---

## Features at a glance

| Area | What she gets |
|---|---|
| **WhatsApp** | Self-onboarding, two-way AI chat, voice notes in/out, danger detection + CHW alert, photo reading, postpartum switch, weekly "how are you feeling?" check-in |
| **Danger signs** | Deterministic, multi-language, pregnancy + postpartum + newborn; instant urgent reply + clinician alert |
| **Voice** | Voice notes (server Whisper/SoroTTS) **and** on-device browser voice fallback (offline / no cost); voice sign-up |
| **Offline ("Am I okay?")** | Danger checklist, ANC schedule, curated Q&A, on-device AI chat + on-device photo reading — all with no network |
| **Photo** | ANC card / drug / test-result reading + safety flag |
| **Clinic / CHW** | Enrol mothers, alert queue, WhatsApp-her, close-the-loop outcomes, **impact report + CSV** |
| **Postpartum** | Birth announcement → newborn danger signs + free immunization schedule & reminders |
| **Web app** | Personalised weekly updates, baby size, journal, vitals + risk alerts, hospital locator, symptom triage, appointments, library search |
| **Channels** | WhatsApp (Evolution API) **and Telegram** — full feature parity (onboarding, danger detection, voice, photo, postpartum) — plus web + installable Android app (PWA/TWA) |
| **Languages** | English, Pidgin, Yoruba, Hausa, Igbo (UI + AI replies) |

---

## The AI

Bumply uses a **layered "brain"** so it's always safe, fast, and never fully dependent on one
service:

- **Safety layer (no AI):** the deterministic danger-sign checker runs first, on-device-capable,
  in 5 languages. Red flags never depend on a model being up.
- **Conversational brain:** an OpenAI-compatible LLM. Primary = **NVIDIA NIM**
  (`llama-3.1-8b-instruct`), grounded in her week, journal, chat history, and a **RAG** knowledge
  base (pgvector + keyword) of vetted WHO/Nigeria guidance. Concise, WhatsApp-tuned, never diagnoses.
- **HelpMum open-source integration:** HelpMum's own **MamaBot** (maternal LLM) and
  **English↔Yoruba translators** are deployed on our Modal (scale-to-zero). For Yoruba mothers,
  Bumply answers in English then renders fluent Yoruba via HelpMum's translator.
- **Vision:** photo reading uses a **free multimodal model** (`llama-3.2-11b-vision`), with a
  second pass through the text model to flag abnormal clinical values.
- **Voice:** speech-to-text (Whisper) + text-to-speech (SoroTTS, Nigerian-language voices) on
  Modal, **with an on-device browser-voice fallback** so voice keeps working offline / at no cost.

## The small models (on-device / "build small")

Everything below runs **in the phone's browser** or **scale-to-zero on Modal** (pay-per-use,
never always-on):

- **On-device chat:** `SmolLM2-135M-Instruct` (~135M) via transformers.js (WASM) — answers basic
  questions offline, grounded by the curated 103-item KB.
- **On-device photo reading:** `SmolVLM-256M-Instruct` — reads a card/medicine offline.
- **On-device speech:** `whisper-tiny` for listening + the browser's built-in TTS/ASR for
  speaking/hearing — **no network, no bill**.
- **Curated knowledge pack:** `public/offline/maternal-qa.json` — 103 vetted, plain-language
  Q&A; cached on-device, grounds the offline model, and doubles as fine-tuning data.
- **Fine-tune pipeline (ready, opt-in):** `modal/finetune.py` — LoRA-fine-tunes `SmolLM2-360M`
  into a maternal helper on the curated data, to distil knowledge into the offline model.
- **Reliability:** on-device danger checks + curated answers mean the highest-stakes features
  never go dark, even with no signal and no cloud.

---

## Architecture (one paragraph)

Next.js 16 (App Router, TypeScript) on Railway. Data in a **self-hosted Supabase/Postgres**
(schema `preg_companion`) reached over a REST bridge. WhatsApp via a self-hosted **Evolution
API**; Telegram via bot API; email via **Plunk**. AI via NVIDIA NIM + Modal (HelpMum models,
voice, optional vision/fine-tune). Auth is self-contained (bcrypt + `jose` cookies). The
Android app is a TWA wrapper of the installable PWA, built in CI (GitHub Actions).

## Repo map (where things live)

```
app/                     Next.js routes + UI
  api/whatsapp/webhook   WhatsApp brain (onboarding, danger, voice, photo, postpartum)
  api/clinic/*           CHW/clinician portal + close-the-loop + CSV export
  sos/                   offline "Am I okay?" page
  immunization/          baby vaccine schedule
  _components/           OfflineHelper (on-device AI/voice/photo), ChatPanel, ClinicReport, RegisterForm…
lib/                     dangerSigns, immunization, postpartum, waOnboard, vision, localVoice,
                         companion, ai, translate, evolution, notify, queries, i18n…
public/offline/          maternal-qa.json (103-item on-device KB) + service worker
modal/                   HelpMum MamaBot, translators, (optional) vision + fine-tune
scripts/                 unit.mts, e2e.mts (test suites)
tests/                   Playwright UI/accessibility suite
```

## Run it locally (developers)

```bash
cp .env.example .env.local     # fill DB, NVIDIA key, AUTH_SECRET (openssl rand -hex 32)…
npm install
npm run build
PORT=3005 npm start            # ⚠ use a non-3000 port, see below
```
> ⚠️ **Port 3000 is occupied by another local project on the build machine** — always run
> Bumply on another port (e.g. 3005/3007). Verify with `curl -s localhost:PORT/login | grep '<title>'`.

**Tests:** `npm run test:unit` (48) · `npm run test:e2e` (71) · `npm run test:pw` (18) — see
[DEMO-TESTING.md](./DEMO-TESTING.md) for the full pre-demo checklist and what to install.

---

_Deliverables stay local. Not medical advice — Bumply gives safe, general guidance and always
routes danger signs to a clinic/hospital._
