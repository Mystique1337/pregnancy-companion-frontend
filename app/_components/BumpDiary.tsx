"use client";
import { useEffect, useRef, useState } from "react";

type Photo = { id: string; week_number: number | null; note: string | null; created_at: string };

// Downscale + JPEG-compress in the browser so uploads stay small (~100-300KB)
// regardless of the original phone-camera size.
async function compress(file: File, maxDim = 1280, quality = 0.82): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();
  return canvas.toDataURL("image/jpeg", quality);
}

export default function BumpDiary({ defaultWeek }: { defaultWeek: number }) {
  const [photos, setPhotos] = useState<Photo[] | null>(null);
  const [week, setWeek] = useState(String(defaultWeek));
  const [note, setNote] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  async function load() {
    const r = await fetch("/api/bump");
    const d = await r.json().catch(() => ({}));
    setPhotos(d.photos || []);
  }
  useEffect(() => { load(); }, []);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setErr("");
    try {
      setPreview(await compress(file));
    } catch {
      setErr("Couldn't read that image — try another photo.");
    }
  }

  async function save() {
    if (!preview) { setErr("Choose a photo first."); return; }
    setBusy(true); setErr("");
    const res = await fetch("/api/bump", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dataUrl: preview, week, note }),
    });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setErr(d.error || "Could not save."); return; }
    setPreview(null); setNote("");
    if (fileRef.current) fileRef.current.value = "";
    load();
  }

  async function remove(id: string) {
    if (!confirm("Delete this photo?")) return;
    await fetch(`/api/bump?id=${id}`, { method: "DELETE" });
    setPhotos((p) => (p ? p.filter((x) => x.id !== id) : p));
  }

  return (
    <div>
      {/* Upload card */}
      <div className="card" style={{ marginBottom: 28 }}>
        <p className="s-label">Add this week&apos;s photo</p>
        {preview ? (
          <div style={{ margin: "12px 0" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview} alt="Preview" style={{ width: "100%", maxWidth: 280, borderRadius: 14, display: "block" }} />
          </div>
        ) : (
          <label
            style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, padding: "34px 16px", margin: "12px 0", border: "1.5px dashed var(--pink)", borderRadius: 16, background: "var(--pink-pale)", cursor: "pointer", textAlign: "center" }}
          >
            <span style={{ fontSize: 30 }}>📸</span>
            <span style={{ fontSize: 14, color: "var(--ink-mid)" }}>Tap to choose or take a photo</span>
            <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={onPick} style={{ display: "none" }} />
          </label>
        )}

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end", marginTop: 6 }}>
          <div>
            <label className="s-label" style={{ display: "block", marginBottom: 6 }}>Week</label>
            <input type="number" min={1} max={45} value={week} onChange={(e) => setWeek(e.target.value)} style={inp} />
          </div>
          <div style={{ flex: 1, minWidth: 180 }}>
            <label className="s-label" style={{ display: "block", marginBottom: 6 }}>Note (optional)</label>
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="how you're feeling…" style={{ ...inp, width: "100%" }} />
          </div>
        </div>

        {err && <p style={{ color: "var(--pink)", fontSize: 13, marginTop: 12 }}>{err}</p>}
        <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
          <button className="f-submit" style={{ maxWidth: 180 }} onClick={save} disabled={busy || !preview}>{busy ? "Saving…" : "Save photo"}</button>
          {preview && <button className="btn-ghost btn-back" onClick={() => { setPreview(null); if (fileRef.current) fileRef.current.value = ""; }}>Choose another</button>}
        </div>
      </div>

      {/* Gallery */}
      {photos === null ? (
        <p className="muted">Loading your diary…</p>
      ) : photos.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: "36px 20px" }}>
          <div style={{ fontSize: 34, marginBottom: 8 }}>🤰</div>
          <p className="muted">No photos yet. Add your first above — your bump timeline will grow here.</p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 14 }}>
          {photos.map((p) => (
            <figure key={p.id} className="card" style={{ margin: 0, padding: 0, overflow: "hidden", position: "relative" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/api/bump/photo?id=${p.id}`} alt={p.week_number ? `Week ${p.week_number}` : "Bump photo"} style={{ width: "100%", aspectRatio: "3/4", objectFit: "cover", display: "block" }} loading="lazy" />
              <button onClick={() => remove(p.id)} title="Delete" style={delBtn}>✕</button>
              <figcaption style={{ padding: "10px 12px" }}>
                {p.week_number != null && <span style={{ display: "block", fontSize: 11, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--pink)", fontWeight: 700 }}>Week {p.week_number}</span>}
                {p.note && <span style={{ display: "block", fontSize: 13, color: "var(--ink-mid)", marginTop: 2 }}>{p.note}</span>}
                <span style={{ display: "block", fontSize: 11, color: "var(--ink-muted)", marginTop: 3 }}>{new Date(p.created_at).toLocaleDateString()}</span>
              </figcaption>
            </figure>
          ))}
        </div>
      )}
    </div>
  );
}

const inp: React.CSSProperties = { padding: "10px 12px", borderRadius: 10, border: "1px solid var(--border)", fontSize: 14, fontFamily: "var(--sans)", maxWidth: 110 };
const delBtn: React.CSSProperties = { position: "absolute", top: 8, right: 8, width: 26, height: 26, borderRadius: "50%", border: "none", background: "rgba(46,38,32,0.55)", color: "white", fontSize: 12, cursor: "pointer", lineHeight: 1 };
