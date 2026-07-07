import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { meiliSearch, meiliConfigured } from "@/lib/meili";
import { kbKeywordSearch } from "@/lib/rag";

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  const q = String(b.q || "");

  // Prefer Meilisearch when it's up; fall back to a DB keyword search over the KB
  // so library search keeps working even if Meili is down/unconfigured.
  let hits: { title: string; source: string; content: string }[] = [];
  if (meiliConfigured()) hits = await meiliSearch(q, 8).catch(() => []);
  if (hits.length === 0) hits = await kbKeywordSearch(q, 8).catch(() => []);

  return NextResponse.json({ ok: true, hits });
}
