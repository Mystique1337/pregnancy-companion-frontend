# Bumply — pre-demo test guide (web app + Android app)

Run through this before any demo. It covers **what to install**, the **automated test
suites**, and a **manual checklist** for the web app, WhatsApp, and the Android app.

- **Live web app:** https://app.bumply.mom
- **WhatsApp bot:** +234 815 417 4140
- **Telegram bot:** @My_bumplycompanionbot
- Estimated full manual pass: ~30–40 min.

---

## 0) What to download / install

**To demo (minimum):**
- A phone or laptop with **Chrome** (voice + on-device AI need a Chromium browser).
- The **Android APK** — from GitHub → the repo's **Actions → "Build Android APK"** run →
  download the **`bumply-apk`** artifact (`app-release-signed.apk`). A signed copy is also at
  `../bumply-apk/app-release-signed.apk` on the build machine.
- A **spare WhatsApp number** (a second phone / WhatsApp account) to test self-onboarding —
  the bot won't onboard *its own* number.
- One or two **photos** to test photo-reading: an ANC/antenatal card, a medicine packet, or a
  printed lab result (a clear, well-lit photo).

**To run the code / automated tests (developers):**
- **Node 20+** and the repo cloned; run `npm install`.
- For the browser test suite: `npx playwright install chromium` (downloads ~1 headless Chrome).
- On-device AI models download **once, over WiFi, inside the app** (SmolLM ~100MB,
  SmolVLM/whisper smaller) — not shipped in the APK. Do this warm-up before a demo.

---

## 1) 60-second live smoke test (no setup)

Open each and confirm it loads:

| URL | Expect |
|---|---|
| https://app.bumply.mom/ | Landing page, "Join Bumply" signup form |
| https://app.bumply.mom/login | Login page (title says "Bumply") |
| https://app.bumply.mom/sos | "Am I okay?" — **red** danger block + 🔊 Read-aloud buttons |
| https://app.bumply.mom/immunization | "Baby immunization schedule" (BCG … Measles) |
| https://app.bumply.mom/api/health | `{"ok":true,...}` |

---

## 2) Automated test suites (developers)

```bash
# from the repo root
npm run build

# unit tests — pure logic (danger signs incl. native langs, immunization, KB, onboarding parsing)
npm run test:unit            # expect: 48 passed · 0 failed

# start the app on a NON-3000 port (port 3000 is taken by another local app)
PORT=3007 npm start
# verify it's really Bumply:
curl -s localhost:3007/login | grep '<title>'   # must say "Bumply"

# integration + browser suites (against that server)
E2E_BASE=http://localhost:3007 npm run test:e2e         # expect: 71 passed · 0 failed
PLAYWRIGHT_BASE=http://localhost:3007 npm run test:pw   # expect: 18 passed
```

> The e2e clinic tests need a seeded clinician. If they 401 on clinic login, insert one:
> `ada@clinic.test` / `clinic12345` into `preg_companion.clinicians` (bcrypt hash), or create
> one in the admin panel (below).

**Current status: unit 48/48 · e2e 71/71 · playwright 18/18 (all green).**

---

## 3) Web app — manual checklist

### 3a. Onboarding (short, language-first, voice)
1. Go to `/#register`. Confirm the form is **language-first**, short, with optional fields
   collapsed under **"More details"**.
2. Change **language** → labels switch language.
3. (Chrome) Tap **"🎤 Sign up by voice"** → it asks your name, then your weeks; speak them →
   the name + week fields fill in. *(If the phone lacks speech support the button is hidden.)*
4. Fill name + week + email + password (≥8), press **Start** → lands on the dashboard.

### 3b. Voice-first chat (premium)
> Chat is a premium feature; a **free** account is intentionally routed to the free offline
> voice helper instead. To demo full chat, upgrade via `/pricing` (no payment — it's a stub).
1. Open `/chat`. Confirm the always-visible **"🎤 …tap the mic and speak"** hint (localized).
2. Tap the **mic (48px)** → it pulses + shows "Listening…". Speak a question → it transcribes,
   sends, and **reads the reply aloud** in your language.
3. On any reply, tap the prominent **"🔊 Listen"** button → it reads aloud; tap **"⏹ Stop"** to stop.
4. **Local voice fallback:** turn off the Modal voice (or go offline) → voice still works using
   the phone's built-in speech.

### 3c. Offline "Am I okay?" (the offline star)
1. Open `/sos`. Confirm the **alarm-red** danger block; tap a **🔊** on any danger line → it
   reads aloud (works offline).
2. In **"Ask a question"**, type a danger phrase (e.g. "I am bleeding heavy") → instant urgent
   guidance (no model needed). Type a common question ("what should I eat") → a curated answer.
3. Tap **"⬇️ Add the offline helper"** (WiFi, one-time) → after it loads, ask a question offline.
4. Tap **"📷 Read a photo"** → pick an ANC card/medicine → it reads it on-device.
5. **True offline test:** enable airplane mode / DevTools "Offline", reload `/sos` → it still
   loads (service worker) and danger checks + curated answers + read-aloud still work.

### 3d. Immunization
1. `/immunization` → the full Nigerian schedule (birth → 15 months). Also linked from the
   dashboard ("Baby vaccines").

### 3e. Clinic / CHW portal + impact
1. Log in at `/clinic/login` (see credentials below).
2. Confirm the **Impact report** at the top: Reach / Danger-sign alerts / Outcomes cards.
3. Tap **"⬇️ Download CSV"** → a `bumply-alerts.csv` downloads (all alerts).
4. On any alert: **"Did she reach care?"** → tap an outcome → the impact %/counts update.
5. Enrol a mother by phone (CHW dashboard) and confirm she appears under "My mothers".

### 3f. Bottom nav (mobile, ≤860px width)
- Confirm 5 tabs incl. a **red 🆘 Help** tab → `/sos`. On a **free** account the "Ask" tab also
  routes to the free helper (never a dead paywall).

---

## 4) WhatsApp — manual checklist  (use a spare number)

Message **+234 815 417 4140** from a number **not** already registered.

1. **Self-onboarding:** send "hi" → it asks your **name**, then **how many weeks** → confirms
   you're enrolled. (You can answer the questions with a **voice note** too.)
2. **Danger sign:** send "I am seeing plenty blood" (or Pidgin/Yoruba: "mo n rí ẹjẹ") → an
   **instant urgent reply** to go to hospital. A matching alert shows in the clinic portal.
3. **Normal chat:** ask "what should I eat?" → a warm, concise answer in your language.
4. **Voice note:** send a voice note question → it transcribes, answers, and (if you spoke)
   replies with a **voice note** back.
5. **Photo:** send a photo of an ANC card / medicine → it reads it back + flags anything worrying.
6. **Postpartum:** send "I don born" / "baby is born" → it congratulates, switches to newborn
   safety, and gives the **free immunization** schedule.

> If WhatsApp is unresponsive, the Evolution instance may need reconnecting (QR) in the admin
> panel → WhatsApp. Telegram (@My_bumplycompanionbot) is a reliable backup channel for the same brain.

---

## 5) Android app — manual checklist

1. **Install:** transfer `app-release-signed.apk` to the phone (or `adb install app-release-signed.apk`).
   Allow "install from unknown sources" if prompted. It installs as **Bumply**.
2. **Launch:** it opens **full-screen** (no browser bar) on `app.bumply.mom` — this confirms the
   TWA + Digital Asset Links are working.
3. **Log in / sign up** (or use voice sign-up).
4. **Warm up the offline AI (do this on WiFi before the demo):** open `/sos` → "Add the offline
   helper" and let the model download; also tap "Read a photo" once to fetch the vision model.
5. **Go offline:** enable **airplane mode**. Reopen the app → open **"Am I okay?"**:
   - Danger checks work (type/❓ a danger phrase).
   - Curated answers work; the on-device model answers basic questions.
   - **🔊 Read-aloud** works (built-in voice).
   - **📷 photo reading** works on-device.
6. **Install prompt / home-screen icon:** confirm the Bumply icon + splash look right.

> The APK is a thin TWA wrapper of the live PWA, so its content always matches production.
> Rebuild the APK only when the icon/manifest/package changes (GitHub Actions → Build Android APK).

---

## 6) Test accounts & credentials

- **Mother (web):** sign up a fresh one, or use a seeded test account if present
  (`amara.test@bumply.test` / `bumply123`). Upgrade to premium via `/pricing` (no payment).
- **Clinician:** `/clinic/login`. Create one in the **admin panel** → *Clinicians*, or seed
  `ada@clinic.test` / `clinic12345`.
- **Admin:** `/admin/login`, password = the `ADMIN_PASSWORD` env value (ask the maintainer).
- **WhatsApp:** bot number **+234 815 417 4140** — message from a *different*, unregistered number.

---

## 7) Troubleshooting

| Symptom | Fix |
|---|---|
| Local server "not Bumply" / everything redirects to `/login?redirectTo=` | You hit the other app on **port 3000** — use `PORT=3007` and re-check the `<title>`. |
| Clinic login 401 in tests | Seed the `ada@clinic.test` clinician (see §2) or create one in admin. |
| Voice button missing | The browser lacks Web Speech support — use Chrome/Android; typing still works. |
| Offline AI won't load | It needs **one online download over WiFi** first; then it works offline. |
| WhatsApp silent | Reconnect the Evolution instance (admin → WhatsApp, scan QR); use Telegram as backup. |
| Photo reading says "couldn't read" | Use a clearer, well-lit, straight-on photo; retry. |

---

_Not medical advice — Bumply gives safe, general guidance and always routes danger signs to a
clinic/hospital._
