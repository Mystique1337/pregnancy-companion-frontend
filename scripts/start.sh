#!/usr/bin/env bash
set -uo pipefail

# Optional Cloudflare Tunnel sidecar.
#
# When CF_ACCESS_HOSTNAME is set, open a local TCP proxy (via `cloudflared access
# tcp`) to the tunnelled self-hosted Postgres, so the app can talk fast, direct
# Postgres instead of the slower REST bridge. To activate on Railway, set:
#   CF_ACCESS_HOSTNAME       e.g. db.shinzii.me   (the tunnel's public hostname)
#   CF_ACCESS_CLIENT_ID      Cloudflare Access service-token client id
#   CF_ACCESS_CLIENT_SECRET  Cloudflare Access service-token client secret
#   CF_LOCAL_PORT            local port to listen on (default 6543)
#   SUPABASE_DB_URL          postgres://<user>:<pw>@127.0.0.1:${CF_LOCAL_PORT}/postgres
#   (and REMOVE SUPABASE_REST_URL so lib/db.ts uses the direct driver)
#
# When CF_ACCESS_HOSTNAME is unset, the app starts unchanged (REST bridge).

LOCAL_PORT="${CF_LOCAL_PORT:-6543}"

if [ -n "${CF_ACCESS_HOSTNAME:-}" ]; then
  echo "[start] cloudflared access tcp → ${CF_ACCESS_HOSTNAME} on 127.0.0.1:${LOCAL_PORT}"
  cloudflared access tcp \
    --hostname "${CF_ACCESS_HOSTNAME}" \
    --url "127.0.0.1:${LOCAL_PORT}" \
    ${CF_ACCESS_CLIENT_ID:+--service-token-id "${CF_ACCESS_CLIENT_ID}"} \
    ${CF_ACCESS_CLIENT_SECRET:+--service-token-secret "${CF_ACCESS_CLIENT_SECRET}"} \
    --loglevel warn &
  # Wait (max ~30s) for the local proxy to start accepting connections.
  for _ in $(seq 1 30); do
    if (exec 3<>"/dev/tcp/127.0.0.1/${LOCAL_PORT}") 2>/dev/null; then
      exec 3>&- 3<&-
      echo "[start] tunnel proxy is up"
      break
    fi
    sleep 1
  done
fi

exec npm run start
