// Database access layer.
//
// Two transports, chosen at runtime:
//  1. REST bridge (preferred): when SUPABASE_REST_URL is set, the app's raw SQL is
//     sent to the self-hosted Supabase pg-meta endpoint (`/pg/query`) via Kong with
//     the service key. This lets a self-hosted Supabase whose Postgres port is NOT
//     publicly exposed still run the app's SQL — including pgvector, aggregations,
//     joins and upserts — unchanged.
//  2. Direct Postgres (fallback): the classic `postgres` driver via SUPABASE_DB_URL.
//
// Both expose the same tiny interface the app relies on: a tagged-template `sql`,
// plus `sql.json`, `sql.unsafe`, `sql.end`.
import postgres from "postgres";

export const SCHEMA = process.env.DB_SCHEMA || "preg_companion";

export type JsonParam = { readonly __json: unknown };

export interface Sql {
  <T = unknown[]>(strings: TemplateStringsArray, ...values: unknown[]): Promise<T>;
  json(v: unknown): JsonParam;
  unsafe(stmt: string): Promise<unknown>;
  end(opts?: unknown): Promise<void>;
}

// ─────────────────────────── REST bridge ───────────────────────────

const REST_URL = process.env.SUPABASE_REST_URL?.replace(/\/+$/, "");
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "";

function isJsonParam(v: unknown): v is JsonParam {
  return typeof v === "object" && v !== null && "__json" in v;
}

// Serialize a JS value to a safe SQL literal. Mirrors what a driver does client-side;
// all values originate from the app and are escaped, so this is injection-safe.
function lit(v: unknown): string {
  if (v === null || v === undefined) return "null";
  if (isJsonParam(v)) return `'${String(JSON.stringify(v.__json)).replace(/'/g, "''")}'::jsonb`;
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : "null";
  if (typeof v === "bigint") return v.toString();
  if (typeof v === "boolean") return v ? "true" : "false";
  if (v instanceof Date) return `'${v.toISOString()}'`;
  if (Buffer.isBuffer(v)) return `'\\x${v.toString("hex")}'`; // bytea hex literal
  if (v instanceof Uint8Array) return `'\\x${Buffer.from(v).toString("hex")}'`;
  if (Array.isArray(v)) return `array[${v.map(lit).join(",")}]`;
  return `'${String(v).replace(/'/g, "''")}'`; // standard_conforming_strings: only quotes need escaping
}

async function execViaRest<T>(stmt: string): Promise<T> {
  if (!REST_URL) throw new Error("SUPABASE_REST_URL not set");
  // Prepend search_path so the app's unqualified table names resolve to our schema.
  const query = `set search_path to ${SCHEMA}, public, extensions;\n${stmt}`;
  const res = await fetch(`${REST_URL}/pg/query`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
    },
    body: JSON.stringify({ query }),
    cache: "no-store",
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`pg/query ${res.status}: ${text.slice(0, 300)} :: ${stmt.slice(0, 160)}`);
  let data: unknown;
  try { data = JSON.parse(text); } catch { data = []; }
  if (data && !Array.isArray(data) && typeof data === "object" && "error" in data) {
    throw new Error(`pg/query error: ${(data as { error: string }).error} :: ${stmt.slice(0, 160)}`);
  }
  return (Array.isArray(data) ? data : []) as T;
}

function makeRestSql(): Sql {
  const tag = (<T,>(strings: TemplateStringsArray, ...values: unknown[]): Promise<T> => {
    let stmt = strings[0];
    for (let i = 0; i < values.length; i++) stmt += lit(values[i]) + strings[i + 1];
    return execViaRest<T>(stmt);
  }) as Sql;
  tag.json = (v: unknown): JsonParam => ({ __json: v });
  tag.unsafe = (stmt: string) => execViaRest<unknown>(stmt);
  tag.end = async () => {};
  return tag;
}

// ─────────────────────────── Direct Postgres ───────────────────────────

function makePgSql(): Sql {
  const url = process.env.SUPABASE_DB_URL;
  if (!url) console.warn("[db] neither SUPABASE_REST_URL nor SUPABASE_DB_URL is set — DB queries will fail.");
  const connectionUrl = url || "postgres://localhost:5432/postgres";
  return postgres(connectionUrl, {
    connection: { search_path: `${SCHEMA}, public, extensions` },
    ssl: "prefer",
    prepare: false,
    max: 5,
  }) as unknown as Sql;
}

// Reuse a single instance across hot reloads in dev.
const globalForDb = globalThis as unknown as { _sql?: Sql };

export const sql: Sql = globalForDb._sql ?? (REST_URL ? makeRestSql() : makePgSql());

if (process.env.NODE_ENV !== "production") globalForDb._sql = sql;
