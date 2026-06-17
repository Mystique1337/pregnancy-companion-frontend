import { sql } from "./db";

export type Settings = {
  premium_price: string; // display string, e.g. "₦2,500"
  ai_model: string; // optional override of NVIDIA_MODEL ("" = use env default)
  weekly_send_day: string; // 'monday' .. 'sunday'
  journal_enabled: boolean;
  tools_enabled: boolean;
  chat_enabled: boolean;
};

export const SETTING_DEFAULTS: Settings = {
  premium_price: "₦2,500",
  ai_model: "",
  weekly_send_day: "monday",
  journal_enabled: true,
  tools_enabled: true,
  chat_enabled: true,
};

function toBool(v: string | undefined, d: boolean): boolean {
  if (v == null) return d;
  return v === "true" || v === "1";
}

// Settings change rarely (admin-only) but are read on every page render. Cache
// in-process with a short TTL so a normal page load costs zero DB round-trips.
let _cache: { at: number; val: Settings } | null = null;
const SETTINGS_TTL_MS = 30_000;

export function invalidateSettings() {
  _cache = null;
}

export async function getSettings(): Promise<Settings> {
  const now = Date.now();
  if (_cache && now - _cache.at < SETTINGS_TTL_MS) return _cache.val;
  const val = await loadSettings();
  _cache = { at: now, val };
  return val;
}

async function loadSettings(): Promise<Settings> {
  try {
    const rows = await sql<{ key: string; value: string }[]>`select key, value from app_settings`;
    const m = Object.fromEntries(rows.map((r) => [r.key, r.value]));
    return {
      premium_price: m.premium_price ?? SETTING_DEFAULTS.premium_price,
      ai_model: m.ai_model ?? SETTING_DEFAULTS.ai_model,
      weekly_send_day: m.weekly_send_day ?? SETTING_DEFAULTS.weekly_send_day,
      journal_enabled: toBool(m.journal_enabled, SETTING_DEFAULTS.journal_enabled),
      tools_enabled: toBool(m.tools_enabled, SETTING_DEFAULTS.tools_enabled),
      chat_enabled: toBool(m.chat_enabled, SETTING_DEFAULTS.chat_enabled),
    };
  } catch {
    return SETTING_DEFAULTS;
  }
}

export async function setSetting(key: string, value: string) {
  await sql`
    insert into app_settings (key, value, updated_at) values (${key}, ${value}, now())
    on conflict (key) do update set value = ${value}, updated_at = now()`;
  invalidateSettings(); // admin just changed a setting — drop the cache so it takes effect now
}

/** Model to use for AI calls: admin override if set, else env/default. */
export async function resolveModel(envDefault: string): Promise<string> {
  const s = await getSettings();
  return s.ai_model?.trim() || envDefault;
}
