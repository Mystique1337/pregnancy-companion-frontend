# Cloudflare Tunnel → fast direct-Postgres (optional speed upgrade)

The app currently reaches the self-hosted DB over the **REST bridge** (`/pg/query`),
which works but adds an HTTPS round-trip per query. This sets up a **Cloudflare
Tunnel** so Railway can talk **direct Postgres** (fast) without exposing the
Postgres port to the public internet.

Railway side is already built (a gated `cloudflared` sidecar in `scripts/start.sh`).
You do the VPS + Cloudflare parts below, send me 3 values, and I flip it on.

---

## 1. On the VPS (where Supabase runs)

Run cloudflared on the same Docker network as Supabase so it can reach `supabase-db`.
Add this service to your Supabase `docker-compose.yml` (same network as `db`):

```yaml
  cloudflared-db:
    image: cloudflare/cloudflared:latest
    restart: unless-stopped
    command: tunnel run
    environment:
      - TUNNEL_TOKEN=${CF_TUNNEL_TOKEN}   # from step 2
    networks:
      - default        # the network the supabase `db` service is on
```

## 2. In the Cloudflare dashboard (Zero Trust → Networks → Tunnels)

1. **Create a tunnel** (e.g. `bumply-db`). Copy its **tunnel token** → set as
   `CF_TUNNEL_TOKEN` on the VPS (step 1), then `docker compose up -d cloudflared-db`.
2. Add a **Public Hostname** to the tunnel:
   - Subdomain/hostname: **`db.shinzii.me`**
   - Type: **TCP**
   - URL: **`supabase-db:5432`**  (the Postgres container:port)

## 3. Protect it with an Access service token (Zero Trust → Access)

1. **Applications → Add → Self-hosted**, hostname `db.shinzii.me`.
2. Add a policy: **Action = Service Auth**, include the service token from the next step.
3. **Service Auth → Create Service Token** → copy the **Client ID** and **Client Secret**.

---

## 4. Send me these 3 values

- `CF_ACCESS_HOSTNAME` = `db.shinzii.me`
- `CF_ACCESS_CLIENT_ID` = `<...>.access`
- `CF_ACCESS_CLIENT_SECRET` = `<...>`

Then I set on Railway (and redeploy):

```
CF_ACCESS_HOSTNAME=db.shinzii.me
CF_ACCESS_CLIENT_ID=...
CF_ACCESS_CLIENT_SECRET=...
CF_LOCAL_PORT=6543
SUPABASE_DB_URL=postgres://postgres:<SERVICE_PASSWORD_POSTGRES>@127.0.0.1:6543/postgres
# and I REMOVE SUPABASE_REST_URL so lib/db.ts uses the direct driver
```

The app then talks direct Postgres through the tunnel — fast — with nothing exposed
to the public internet. If anything misbehaves, deleting the CF_* vars instantly
reverts to the REST bridge.

> Simpler alternative if you'd rather skip Cloudflare Access: just publish the
> Postgres/Supavisor port and firewall-allow it — but that's public exposure, which
> the tunnel avoids.
