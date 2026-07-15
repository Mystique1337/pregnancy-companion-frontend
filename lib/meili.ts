// Minimal Meilisearch client (REST). Keyword/typo-tolerant search over the KB.
const URL = (process.env.MEILI_URL || "").replace(/\/+$/, "");
const KEY = process.env.MEILI_KEY || "";
const INDEX = process.env.MEILI_INDEX || "kb";

export function meiliConfigured(): boolean {
  return !!(URL && KEY);
}

async function mfetch(path: string, init?: RequestInit) {
  return fetch(`${URL}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json", ...(init?.headers || {}) },
    cache: "no-store",
  });
}

export type KbDoc = { id: string; title: string; source: string; content: string };

/** Configure searchable/displayed fields (idempotent). */
export async function meiliConfigure(): Promise<void> {
  await mfetch(`/indexes`, { method: "POST", body: JSON.stringify({ uid: INDEX, primaryKey: "id" }) }).catch(() => {});
  await mfetch(`/indexes/${INDEX}/settings`, {
    method: "PATCH",
    body: JSON.stringify({
      searchableAttributes: ["title", "content"],
      displayedAttributes: ["id", "title", "source", "content"],
    }),
  }).catch(() => {});
}

export async function meiliIndexDocs(docs: KbDoc[]): Promise<boolean> {
  if (!meiliConfigured() || docs.length === 0) return false;
  const r = await mfetch(`/indexes/${INDEX}/documents?primaryKey=id`, { method: "POST", body: JSON.stringify(docs) });
  return r.ok;
}

export type MeiliHit = { id: string; title: string; source: string; content: string };

let warnedDown = false;
export async function meiliSearch(q: string, limit = 6): Promise<MeiliHit[]> {
  if (!meiliConfigured() || !q.trim()) return [];
  try {
    const r = await mfetch(`/indexes/${INDEX}/search`, { method: "POST", body: JSON.stringify({ q, limit }) });
    if (!r.ok) {
      // Don't fail silently forever — the host may be gone (it happened): log once.
      if (!warnedDown) { warnedDown = true; console.warn(`[meili] search returned ${r.status} — falling back to DB keyword search (check MEILI_URL)`); }
      return [];
    }
    const d = (await r.json()) as { hits?: MeiliHit[] };
    return d.hits || [];
  } catch (e) {
    if (!warnedDown) { warnedDown = true; console.warn("[meili] unreachable — falling back to DB keyword search:", e instanceof Error ? e.message : e); }
    return [];
  }
}
