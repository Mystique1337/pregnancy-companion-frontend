import postgres from "postgres";

// Don't throw at import (would break `next build` before env vars are set on the host).
// Fall back to a placeholder that simply fails on first query if misconfigured.
const url = process.env.SUPABASE_DB_URL;
if (!url) console.warn("[db] SUPABASE_DB_URL is not set — DB queries will fail until it's configured.");
const connectionUrl = url || "postgres://localhost:5432/postgres";

export const SCHEMA = process.env.DB_SCHEMA || "preg_companion";

// Reuse a single connection across hot reloads in dev.
const globalForDb = globalThis as unknown as { _sql?: ReturnType<typeof postgres> };

export const sql =
  globalForDb._sql ??
  postgres(connectionUrl, {
    // App tables live in our dedicated schema (first). public + extensions are included
    // so the pgvector `vector` type resolves wherever the extension was installed.
    connection: { search_path: `${SCHEMA}, public, extensions` },
    ssl: "prefer",
    prepare: false,
    max: 5,
  });

if (process.env.NODE_ENV !== "production") globalForDb._sql = sql;
