import { notFound } from "next/navigation";
import { getWeeklyUpdateBySlug } from "@/lib/queries";

export const dynamic = "force-dynamic";

// Renders a stored weekly update page (replaces the old static update.html + lookup webhook).
export default async function UpdatePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const update = await getWeeklyUpdateBySlug(slug);
  if (!update || !update.html_content) notFound();

  return (
    <>
      {/* Always give her a way back — the update itself renders in an iframe. */}
      <div style={{ position: "fixed", top: 0, left: 0, right: 0, height: 52, display: "flex", alignItems: "center", gap: 10, padding: "0 14px", background: "rgba(255,250,246,0.96)", backdropFilter: "blur(12px)", borderBottom: "1px solid rgba(46,38,32,0.12)", zIndex: 10 }}>
        <a href="/dashboard" style={{ display: "inline-flex", alignItems: "center", gap: 6, minHeight: 40, padding: "8px 14px", borderRadius: 100, background: "#C97B5A", color: "#fff", fontSize: 14, fontWeight: 600, textDecoration: "none" }}>
          ← Back
        </a>
        <span style={{ fontFamily: "Georgia, serif", fontSize: 15, color: "#2E2620", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {update.subject || `Week ${update.week_number}`}
        </span>
      </div>
      <iframe
        title={update.subject || "Bumply Weekly Update"}
        srcDoc={update.html_content}
        style={{ position: "fixed", top: 52, left: 0, right: 0, bottom: 0, width: "100%", height: "calc(100% - 52px)", border: "none", background: "#fffaf6" }}
      />
    </>
  );
}
