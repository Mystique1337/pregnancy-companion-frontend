// On-device maternal knowledge base. Loaded from /offline/maternal-qa.json (cached
// by the service worker) so the offline helper can answer well with NO network and
// NO GPU bill. A strong keyword match returns the curated answer directly; weaker
// matches are fed to the tiny on-device model as grounding. Doubles as fine-tune data.

export type KbItem = { q: string; a: string; tags: string[] };
export type Kb = { items: KbItem[] };

let cache: Kb | null = null;

export async function loadKb(): Promise<Kb | null> {
  if (cache) return cache;
  try {
    const r = await fetch("/offline/maternal-qa.json", { cache: "force-cache" });
    if (!r.ok) return null;
    const data = await r.json();
    cache = { items: Array.isArray(data?.items) ? data.items : [] };
    return cache;
  } catch {
    return null;
  }
}

const STOP = new Set(["the", "a", "an", "is", "are", "i", "my", "me", "to", "of", "in", "on", "and", "or", "do", "can", "what", "how", "should", "for", "it", "be", "have", "has", "with", "am", "was", "you", "your", "this", "that", "at", "by", "if", "so", "we", "he", "she"]);

function tokens(s: string): string[] {
  return (s || "").toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w));
}

export type Retrieval = { item: KbItem; score: number } | null;

// Score every item against the query by tag hits + word overlap. Returns the best.
export function retrieve(kb: Kb, query: string): Retrieval {
  const qt = tokens(query);
  if (!qt.length || !kb.items.length) return null;
  const qset = new Set(qt);
  let best: { item: KbItem; score: number } | null = null;
  for (const item of kb.items) {
    let score = 0;
    for (const tag of item.tags || []) {
      const tt = tokens(tag);
      // whole-tag phrase present, or any tag word overlaps
      if (tag && query.toLowerCase().includes(tag.toLowerCase())) score += 3;
      for (const w of tt) if (qset.has(w)) score += 2;
    }
    const words = new Set([...tokens(item.q), ...tokens(item.a)]);
    for (const w of qt) if (words.has(w)) score += 1;
    if (!best || score > best.score) best = { item, score };
  }
  return best;
}
