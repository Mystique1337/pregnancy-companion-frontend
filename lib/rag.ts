import { sql } from "./db";
import { embed, embedOne, embeddingsConfigured, EMBED_DIM } from "./embeddings";
import { meiliSearch } from "./meili";

// Format a JS number[] as a pgvector literal.
function vec(nums: number[]): string {
  return `[${nums.join(",")}]`;
}

export async function ensureKb(): Promise<void> {
  await sql.unsafe(`create extension if not exists vector`);
  await sql.unsafe(
    `create table if not exists kb_chunks (
       id uuid primary key default gen_random_uuid(),
       title text, source text, content text not null,
       embedding vector(${EMBED_DIM}),
       created_at timestamptz not null default now()
     )`
  );
}

export type KbHit = { title: string | null; source: string | null; content: string; distance: number };

export async function retrieve(query: string, k = 4): Promise<KbHit[]> {
  if (!embeddingsConfigured()) return [];
  const e = vec(await embedOne(query, "query"));
  return sql<KbHit[]>`
    select title, source, content, (embedding <=> ${e}::vector) as distance
    from kb_chunks
    order by embedding <=> ${e}::vector
    limit ${k}`;
}

export type KbKeywordHit = { id: string; title: string; source: string; content: string };

// UK/US + common-phrasing aliases so "anemia" finds "anaemia", "swollen" finds
// "swelling", etc. — the whole-phrase ILIKE match missed all of these.
const KW_ALIASES: Record<string, string[]> = {
  anemia: ["anaemia"], anaemia: ["anemia"],
  swollen: ["swelling", "swell"], swelling: ["swollen", "swell"],
  diarrhea: ["diarrhoea"], diarrhoea: ["diarrhea"],
  eat: ["food", "diet", "nutrition"], food: ["eat", "diet"],
  tired: ["fatigue", "tiredness"], baby: ["fetal", "foetal"],
};
const KW_STOP = new Set(["the", "a", "an", "is", "are", "i", "my", "me", "to", "of", "in", "on", "and", "or", "do", "can", "what", "how", "should", "for", "it", "be", "have", "with", "am", "was", "you", "your", "this", "that", "when", "why", "will"]);

// Keyword search straight over the knowledge base in Postgres — the resilient
// fallback when Meilisearch is unavailable. Word-based (ANY meaningful word can
// match, one regex parameter), ranked in JS by distinct word hits; the old
// whole-phrase ILIKE returned 0 results for most multi-word questions.
export async function kbKeywordSearch(query: string, limit = 8): Promise<KbKeywordHit[]> {
  const q = query.trim();
  if (!q) return [];
  const words = [...new Set(
    q.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/)
      .filter((w) => w.length > 2 && !KW_STOP.has(w))
      .flatMap((w) => [w, ...(KW_ALIASES[w] || [])])
  )].slice(0, 10);
  if (!words.length) return [];
  const pattern = words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  const rows = await sql<KbKeywordHit[]>`
    select id::text as id, coalesce(title, '') as title, coalesce(source, '') as source, content
    from kb_chunks
    where content ~* ${pattern} or title ~* ${pattern}
    limit 50`;
  const score = (r: KbKeywordHit) => {
    const hay = (r.title + " " + r.content).toLowerCase();
    return words.reduce((n, w) => n + (hay.includes(w) ? 1 : 0), 0);
  };
  return rows.sort((a, b) => score(b) - score(a)).slice(0, limit);
}

// Hybrid retrieval as a ready-to-inject grounding block: semantic (pgvector) +
// keyword (Meilisearch), merged and de-duplicated. Either source can be empty.
export async function groundingBlock(query: string, k = 4): Promise<string> {
  try {
    const [vec, kw] = await Promise.all([
      retrieve(query, k).then((h) => h.filter((x) => x.distance < 0.65)).catch(() => []),
      meiliSearch(query, 3).catch(() => []),
    ]);
    const seen = new Set<string>();
    const lines: string[] = [];
    for (const h of [...vec, ...kw]) {
      const key = h.content.slice(0, 40).toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      lines.push(`- ${h.content}${h.source ? ` (${h.source})` : ""}`);
    }
    return lines.slice(0, 5).join("\n");
  } catch {
    return "";
  }
}

// Like groundingBlock but also returns the distinct source labels used (for citations).
export async function groundingWithSources(query: string, k = 4): Promise<{ block: string; sources: string[] }> {
  try {
    const [vec, kw] = await Promise.all([
      retrieve(query, k).then((h) => h.filter((x) => x.distance < 0.65)).catch(() => []),
      meiliSearch(query, 3).catch(() => []),
    ]);
    const seen = new Set<string>();
    const lines: string[] = [];
    const sources = new Set<string>();
    for (const h of [...vec, ...kw]) {
      const key = h.content.slice(0, 40).toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      lines.push(`- ${h.content}${h.source ? ` (${h.source})` : ""}`);
      if (h.source) sources.add(h.source);
    }
    return { block: lines.slice(0, 5).join("\n"), sources: [...sources].slice(0, 3) };
  } catch {
    return { block: "", sources: [] };
  }
}

export async function ingest(items: { title?: string; source?: string; content: string }[]): Promise<number> {
  if (items.length === 0) return 0;
  const embs = await embed(items.map((i) => i.content), "passage");
  for (let i = 0; i < items.length; i++) {
    await sql`insert into kb_chunks (title, source, content, embedding)
      values (${items[i].title ?? null}, ${items[i].source ?? null}, ${items[i].content}, ${vec(embs[i])}::vector)`;
  }
  return items.length;
}

export async function kbCount(): Promise<number> {
  const r = await sql<{ c: string }[]>`select count(*)::text as c from kb_chunks`;
  return Number(r[0]?.c || 0);
}

export async function clearKb(): Promise<void> {
  await sql.unsafe(`truncate table kb_chunks`);
}
