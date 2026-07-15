# Bumply — Handover

Everything a new owner needs to **operate, deploy, test, and demo** Bumply.
See also: [README.md](./README.md) (what it is + selling points) · [DEMO-TESTING.md](./DEMO-TESTING.md)
(pre-demo checklist) · [BRAINSTORM.md](./BRAINSTORM.md) (roadmap) · [ANDROID.md](./ANDROID.md) (APK).

> ⚠️ **Secrets are never in git.** All live values live in **`.env.local`** (local, git-ignored)
> and on **Railway** (production env). This doc lists variable *names* and *where they live*, not
> values.

---

## 1. System status (verified 2026-07-15 — all green)

| Component | Status | Where |
|---|---|---|
| Web app | ✅ live | https://app.bumply.mom (Railway) |
| Health | ✅ `{ok:true}` | `/api/health` |
| Database | ✅ reachable (26 mothers) | self-hosted Supabase, REST bridge |
| WhatsApp bot | ✅ instance `bumply` state **open** | Evolution API, number **+234 815 417 4140** |
| Telegram bot | ✅ webhook clean, 0 pending | @bumply_bot |
| AI brain | ✅ NVIDIA NIM 200 OK | `llama-3.1-8b-instruct` |
| Photo vision | ✅ free NVIDIA model | `llama-3.2-11b-vision` |
| Cron (daily+weekly) | ✅ scheduled, last run green | GitHub Actions `cron.yml` |
| Android APK | ✅ builds green | GitHub Actions `build-apk.yml` |
| Tests | ✅ unit 48 · e2e 71 · playwright 18 | `npm run test:*` |

---

## 2. Accounts & infrastructure (who owns what)

| Service | Identifier | Account / host |
|---|---|---|
| **GitHub repo** | `Mystique1337/pregnancy-companion-frontend`, branch **`dev-shinzii`** | GitHub `Mystique1337` |
| **Hosting** | Railway project **`bumply`**, service `bumply` | Railway `peniel.tish@gmail.com` |
| **Database** | self-hosted **Supabase** (schema `preg_companion`) | VPS `supabase.shinzii.me` |
| **WhatsApp** | **Evolution API** v2, instance `bumply` | `evo-bumplymessage.shinzii.me` |
| **AI (LLM+vision)** | NVIDIA NIM (OpenAI-compatible) | build.nvidia.com key |
| **AI (HelpMum / voice)** | Modal, scale-to-zero | Modal workspace **`chidi-ashinze`** |
| **Email** | Plunk, verified domain `bumply.mom` | Plunk instance |
| **Telegram** | @bumply_bot | bot token |
| **Domains** | `bumply.mom`, `app.bumply.mom` | DNS provider |

---

## 3. Access to the running system

- **Admin panel:** `https://app.bumply.mom/admin/login` — password = `ADMIN_PASSWORD` (in Railway / `.env.local`).
  From here: user stats, plan/delete, run cron jobs, edit settings/feature flags, **manage clinicians**, WhatsApp connect.
- **Clinician / CHW portal:** `https://app.bumply.mom/clinic/login`. Create a clinician in
  **Admin → Clinicians** (don't reuse the test `ada@clinic.test`). Impact report + CSV live here.
- **Mother app:** anyone can sign up at `/#register` (or by WhatsApp). Upgrade to premium via
  `/pricing` (payment is a **stub** — no real billing yet).
- **WhatsApp:** message **+234 815 417 4140** from a number that isn't the bot's own.

---

## 4. Operations runbook

### Deploy to production
Deploys are **manual** (CLI) today — Railway auto-deploy on push is optional (see below):
```bash
railway up --service bumply --ci        # from repo root, logged in as the Railway owner
# verify:
curl -s https://app.bumply.mom/api/health
```
Env vars are set on the Railway service (mirror of `.env.local`, minus local-only tunnel URLs).
To sync env from `.env.local` → Railway, use `scripts/_railway-vars.mjs`.

**To enable auto-deploy on push** (optional): in Railway, connect the repo (Settings → Source →
`dev-shinzii`) — OR set GitHub repo **variable** `DEPLOY_VIA_ACTIONS=true` + **secrets**
`RAILWAY_TOKEN` (project token) and `RAILWAY_SERVICE=bumply`. (The `deploy.yml` workflow cleanly
skips until then.)

### Scheduled jobs (cron) — already running
GitHub Actions `cron.yml` hits the app on a schedule (verified green):
- **Daily 06:00 UTC** → `/api/cron/daily` — tips, ANC reminders, milestones, **weekly WhatsApp
  check-in**, **immunization reminders** (deduped).
- **Mondays 07:00 UTC** → `/api/cron/weekly` — generate + deliver weekly updates.

Needs repo var `APP_URL` (set) + secret `CRON_SECRET` (set). Trigger manually:
`gh workflow run cron.yml`. Or hit `/(api/cron/daily|weekly)?secret=$CRON_SECRET`.

### Reconnect WhatsApp (if it goes silent)
Admin → **WhatsApp** → Initialise → **Show QR** → scan with the bot phone → wait for "open".
(The instance can drop after a logout/ban; recreate + rescan. Telegram is a live backup channel
for the same brain.)

### Rebuild the Android APK
Push a change under `android/**`, or run `gh workflow run build-apk.yml`. Download the
**`bumply-apk`** artifact from the run. It's a signed TWA wrapper of the live site (see ANDROID.md).

### Rotate a key
Update it in `.env.local` **and** on Railway, then `railway up`. (Never commit it.) For Telegram,
re-set the webhook on boot (automatic) or via `setTelegramWebhook`.

### Logs
Railway dashboard → service `bumply` → Logs. Look for `[wa]` (WhatsApp), `[startup]`, cron output.

---

## 5. Environment variables (names + purpose)

Full template in **`.env.example`**. The essential ones:

| Var | Purpose |
|---|---|
| `SUPABASE_REST_URL`, `SUPABASE_SERVICE_KEY`, `DB_SCHEMA` | DB over the REST bridge (current prod) |
| `AUTH_SECRET` | signed-cookie session secret (`openssl rand -hex 32`) |
| `ADMIN_PASSWORD` | admin panel |
| `NVIDIA_API_KEY`, `NVIDIA_BASE_URL`, `NVIDIA_MODEL` | LLM brain + photo vision (vision reuses this key) |
| `EVOLUTION_API_URL`, `EVOLUTION_API_KEY`, `EVOLUTION_INSTANCE` | WhatsApp |
| `WHATSAPP_WEBHOOK_SECRET` | guards the WhatsApp webhook |
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET` | Telegram |
| `PLUNK_API_KEY` (+ `PLUNK_API_URL`) | email |
| `MODAL_API_KEY`, `MODAL_TTS_URL`, `MODAL_ASR_URL` | voice notes (Whisper/SoroTTS) |
| `MAMABOT_URL`/`_KEY`, `TRANSLATE_URL`/`_KEY` | HelpMum models on Modal (optional; scale-to-zero) |
| `CRON_SECRET` | authorises the cron endpoints |
| `APP_URL` | public base URL |
| `VAPID_*` | web-push |

No new **required** var was added for the latest features — **photo vision reuses `NVIDIA_API_KEY`**,
and local/offline voice runs in the browser (no key).

---

## 6. Health check (run anytime)

```bash
# web
for p in /api/health /login /sos /immunization; do curl -s -o /dev/null -w "$p %{http_code}\n" https://app.bumply.mom$p; done
# DB, WhatsApp state, Telegram webhook — read values from .env.local (see the snippet used at handover):
#   DB:        POST {SUPABASE_REST_URL}/pg/query  {"query":"select count(*) from preg_companion.mothers"}
#   WhatsApp:  GET  {EVOLUTION_API_URL}/instance/connectionState/bumply   (header apikey)  -> state:"open"
#   Telegram:  GET  https://api.telegram.org/bot<token>/getWebhookInfo    -> url set, 0 pending
```

---

## 7. Testing before a demo

```bash
npm install
npm run build
npm run test:unit                                   # 48 pass
PORT=3007 npm start                                 # ⚠ NOT port 3000 (taken by another local app)
E2E_BASE=http://localhost:3007 npm run test:e2e     # 71 pass
PLAYWRIGHT_BASE=http://localhost:3007 npm run test:pw   # 18 pass (needs: npx playwright install chromium)
```
Full manual + Android checklist: **[DEMO-TESTING.md](./DEMO-TESTING.md)**.

---

## 8. Known issues / gotchas

- **Port 3000** on the build machine is taken by an unrelated app — always run Bumply on 3007/3005
  and verify `curl -s localhost:PORT/login | grep '<title>'` says "Bumply".
- **Deploys are manual** (`railway up`) unless you enable auto-deploy (§4).
- **HelpMum MamaBot** output is low quality → it's deployed as proof but OFF the live path
  (`MAMABOT_URL` blank on prod); the reliable brain is NVIDIA. The eng→Yoruba translator IS used.
- **Modal endpoints are scale-to-zero** → the first call after idle cold-starts (a few seconds).
- **On-device AI models** (SmolLM/SmolVLM/whisper) download once over WiFi inside the app — warm
  them up before an offline demo.
- **Billing is a stub** — `/pricing` upgrades to premium with no payment. Wire Paystack for real.
- **IVR** code exists but is dormant (no provider); voice reach = WhatsApp voice notes + in-app voice.

---

## 9. What's next (roadmap)

See **[BRAINSTORM.md](./BRAINSTORM.md)**. Highest-value next items: immunization defaulter
tracking, referral hand-off, SMS fallback (needs a provider token), running the tiny-model
fine-tune. Real billing (Paystack) is the main productionisation gap.

---

_Not medical advice — Bumply gives safe, general guidance and always routes danger signs to a
clinic/hospital._
