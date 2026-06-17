import { getSession } from "@/lib/session";
import { getBumpPhotoData } from "@/lib/queries";

// Streams a bump photo's bytes — only to its owner. Bytes live in Postgres, so
// this is the single read path; metadata is listed separately (never the blob).
export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return new Response("unauthorized", { status: 401 });
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return new Response("id required", { status: 400 });

  const row = await getBumpPhotoData(id, session.sub);
  if (!row) return new Response("not found", { status: 404 });

  return new Response(new Uint8Array(row.data), {
    headers: {
      "Content-Type": row.mime,
      "Cache-Control": "private, max-age=86400",
      "Content-Length": String(row.data.length),
    },
  });
}
