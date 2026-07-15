# Bumply — Master Plan (CareCode Hackathon 2.0)

**Deadline: 20 July 2026. Judge's question: "Would the woman on slide 3 actually use this?"**
She uses WhatsApp daily, code-switches Yoruba/Pidgin, may not read long English, is on a
₦45k Android + 3G, won't explore features. Build for her.

**North star:** *Bumply is a WhatsApp-first AI midwife that catches danger signs in time,
in her language, by voice — powered by HelpMum's open-source models, deployed through CHWs.*

---

## The whole system, in layers

### 1. Channels (how she reaches Bumply)
- **WhatsApp** — primary. Voice + text, danger signs, chat. ✅ LIVE (Evolution, number 2348154174140).
- **SMS** — safety net: ANC/danger-sign reminders + phone-OTP login, no data needed. ⏳ needs a provider (Termii / Africa's Talking).
- **Android app (PWA → APK)** — installable, offline shell, push. ⏳ buildable from the existing PWA (no rewrite).
- **Web app** — CHW + clinician + power users. ✅ exists (rich).
- Telegram — demoted to optional.

### 2. The brain (AI) — HelpMum open-source is the hard requirement
- **`HelpMumHQ/mamabot-llama-1`** (8B) → maternal chat + danger-sign guidance. ⏳ needs hosting.
- **`HelpMumHQ/vax-llama-1`** (8B) → immunization module. ⏳ needs hosting.
- **`HelpMumHQ/AI-translator-eng↔9ja`** (0.5B) → Yoruba in/out layer. ⏳ needs hosting.
- **SoroTTS + Whisper** (Modal) → voice in/out. ✅ LIVE.
- **RAG / pgvector** → grounding in vetted + HelpMum content. ✅.
- **NVIDIA NIM** → automatic fallback so the demo never dies. ✅.
- *Hosting the 8B models:* deploy on **your Modal** (vLLM, OpenAI-compatible) — recommended — or an **HF Inference Endpoint**. Then I point `lib/ai.ts` at it (prefer HelpMum, fall back to NVIDIA).

### 3. Core features (already built — repackage onto WhatsApp)
- Danger-sign checker / triage ✅ · Predictive risk engine + proactive check-ins ✅
- Vitals + red-flag alerts ✅ · Weekly journey + ethnicity meal plan ✅
- Emergency mode (nearest hospital + alert next-of-kin) ✅ · Wellbeing/EPDS screen ✅
- Symptom checker ✅ · Bump diary ✅ · Doctor report ✅

### 4. The human loop / distribution (the winning move for HelpMum)
- **CHW co-pilot** — a Community Health Worker enrolls mothers by phone number and gets
  alerted on danger signs. Mirrors HelpMum's real deployment = impact path + sustainability. ⏳ NEW.
- **Clinician portal** ✅ exists.

### 5. Accessibility / inclusion
- **Voice-first** Pidgin/Yoruba/Hausa/Igbo ✅ tech ready · **Multilingual** UI (5 languages) ✅
- **WhatsApp text** = already Deaf-accessible ✅
- **ASL "Watch in sign language" videos** on the danger-sign messages (ASL = basis of Nigerian SL). ⏳ P2, pre-generated clips.

### 6. Reliability / ops
- **Plunk email** on bumply.mom (real delivery) ✅ · **Password reset** + sliding sessions ✅
- **Passwordless phone-OTP** (her number = identity — kills re-signup for good) ⏳ via SMS.
- Self-hosted Supabase via REST bridge ✅.

---

## Android app — yes, here's how
The app is **already a PWA** (manifest + service worker + offline shell). The fast, no-rewrite path:
- **PWA → TWA APK** via **Bubblewrap / PWABuilder** — point it at `app.bumply.mom`, get a signed,
  installable, Play-Store-ready `.apk`/`.aab` in ~half a day. Web push works on Android via Chrome.
- Deeper native later (camera, native push): **Capacitor** wrapper (still reuses the web code).
- React Native rewrite = NOT worth it before the deadline.
- **Recommendation:** ship the **TWA APK** so you can say "installable Android app" and hand judges
  an APK, while WhatsApp stays the primary surface for the non-tech mother.

---

## The 5-day build order (ruthless)

**P0 — the winning core (no new creds needed except model hosting):**
1. WhatsApp **voice notes** in/out (Pidgin/Yoruba) — she speaks, it speaks back. *(in progress)*
2. **Danger-sign detector** in WhatsApp (keyword + triage → urgent guidance + CHW/clinician alert).
3. Wire **mamabot-llama-1** as the brain (fallback to NVIDIA). *(needs hosting)*

**P1 — reach + the impact/sustainability engine:**
4. **CHW co-pilot** (enroll by phone + danger-sign alerts).
5. **SMS** reminders + **phone-OTP passwordless login**. *(needs SMS key)*
6. **Android APK** from the PWA.

**P2 — depth + inclusion:**
7. **vax-llama-1** immunization module + reminders.
8. **Yoruba translator** layer (native Yoruba I/O).
9. **ASL danger-sign videos**.

---

## The 60-second demo (draw the impact line)
Pidgin voice note *"I dey see blood"* → Bumply understands (HelpMum translator) → thinks
(mamabot-llama) → **voice-replies in her language** "go clinic now" → shows nearest hospital →
**alerts her CHW** → CHW dashboard lights up. Line: *reaches her on the phone she owns, right
info, right time, her language → she seeks care early → fewer of the 82 deaths/day.*

## Sustainability (deck killer #3)
Extend HelpMum's stack, don't compete: deploy via their **CHW network**, use their **open-source
models**, ride their **government handover** path. Revenue: B2B2C to **State PHC boards / HMOs /
clinics**; clinician portal as the product.

## What I need from you
1. **Host mamabot / vax-llama / translators** — Modal (I'll write the deploy) or an HF Endpoint URL+token.
2. **SMS provider** key — Termii or Africa's Talking.
3. Go-ahead on the **Android APK** (I'll polish the manifest + generate it).

## Sources
- HelpMum models: https://huggingface.co/HelpMumHQ
- MamaBot: https://helpmum.org/mamabot
- WhatsApp-chatbot impact: https://allafrica.com/stories/202510240001.html
