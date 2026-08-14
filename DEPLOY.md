# Deploying Bumply

The app is host-agnostic: a Next.js 16 server in a Docker image, no platform SDKs,
no build hooks. It runs on Coolify, plain Docker, Fly, or anything that can run a
container.

## Coolify

### 1. Create the resource

Coolify → **New Resource → Application → Public/Private Repository**

| Setting | Value |
|---|---|
| Repository | `Mystique1337/pregnancy-companion-frontend` |
| Branch | `dev-shinzii` |
| Build Pack | **Dockerfile** |
| Dockerfile location | `/Dockerfile` |
| Port | `3000` |
| Health check path | `/api/health` |

Leave the build and start commands empty. The Dockerfile owns both.

### 2. Environment variables

Copy the names from [`.env.example`](.env.example) into Coolify's environment panel
and fill in the values from your current `.env.local`. That file is generated from
the code, so it lists every variable the app actually reads.

**`APP_URL` is the one that matters most.** Set it to the public URL you are serving
from, for example `https://app.bumply.mom`. Webhooks and email links are built from
it, and if it is wrong they fail silently rather than erroring.

Coolify injects `COOLIFY_URL` as a fallback, but set `APP_URL` explicitly.

### 3. Domain and TLS

Set the domain in Coolify's **Domains** field. Coolify provisions Let's Encrypt
automatically. Point your DNS A record at the VPS first, or the certificate fails.

### 4. Re-point the webhooks

The app is the webhook target for both channels, so after the domain is live:

- **WhatsApp (Evolution):** update the instance webhook to `https://<domain>/api/whatsapp/webhook`
- **Telegram:** re-register with `https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://<domain>/api/telegram/webhook`

Neither happens automatically. Missing this is the usual reason a migrated
deployment looks healthy but stops receiving messages.

### 5. Verify

```bash
curl -s -o /dev/null -w '%{http_code}\n' https://<domain>/api/health   # 200
curl -s https://<domain>/deck | grep -c '<section class="slide'         # 22
```

## Running it locally as a container

```bash
docker build -t bumply .
docker run --rm -p 3000:3000 --env-file .env.local bumply
```

## How the image is built

Three stages, so the runtime carries the built app and nothing else:

1. **deps** installs from `package.json` alone, so the layer caches until
   dependencies actually change.
2. **builder** runs `next build`. `output: "standalone"` traces the exact
   `node_modules` the server needs.
3. **runner** copies the standalone bundle, the static chunks, and `public/`,
   then drops to a non-root user.

### Why `public/` is copied explicitly

Next's standalone tracer only copies the parts of `public/` it sees referenced in
code. It **drops `public/deck` entirely**, because the pitch deck is static HTML the
tracer never sees imported. Verified: without the explicit `COPY public`, `/deck`
returns 404 while `/api/health` returns 200.

If you ever trim the Dockerfile, keep that line.

## Railway (the previous host, still wired up)

Kept for reference. `railway.json` and `nixpacks.toml` are still in the repo and
Railway builds with Nixpacks rather than the Dockerfile.

## 1. CI (GitHub Actions)
`.github/workflows/ci.yml` runs `npm ci && npm run build` (type-check + compile) on every
push to `main` / `dev-shinzii` and on PRs. This is your build gate.

## 2. CD — two options

### Option A (recommended): Railway native GitHub deploy
1. In Railway → **New Project → Deploy from GitHub repo** → pick this repo.
2. Set the **deploy branch to `dev-shinzii`** (Settings → Source → Branch). Railway redeploys on every push to it.
3. Add a **Postgres**? No — Bumply uses your existing self-hosted Supabase/Railway Postgres via `SUPABASE_DB_URL`.
4. Add the env vars below.
5. Railway auto-deploys on every push to that branch. That's your CD. ✅

### Option B: deploy via GitHub Actions
Use `.github/workflows/deploy.yml`. Add repo secrets `RAILWAY_TOKEN` (a Railway **project token**)
and `RAILWAY_SERVICE` (the service name). It runs `railway up` on push to `main`.

Railway injects `PORT` and `RAILWAY_PUBLIC_DOMAIN` automatically, so webhooks work
there without `APP_URL`. On Coolify you must set `APP_URL` yourself.

## Migrating off Railway

Nothing in the app code is Railway-specific. `lib/baseUrl.ts` prefers `APP_URL`
and only falls back to a host-provided domain, and `railway.json` / `nixpacks.toml`
are simply ignored by other platforms. You can leave them in place or delete them.

The cost model in `lib/costs.ts` still lists a Railway line under fixed
infrastructure. Update it to your VPS cost once you know it, since the deck's
"₦240 per mother per month" figure is computed from that file.
